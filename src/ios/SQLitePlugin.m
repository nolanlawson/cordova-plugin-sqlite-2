/*
 * Author: Nolan Lawson
 * License: Apache 2
 */

#import "SQLitePlugin.h"
#import "sqlite3.h"

// Uncomment this to enable debug mode
// #define DEBUG_MODE = 1;

#ifdef DEBUG_MODE
#   define logDebug(...) NSLog(__VA_ARGS__)
#else
#   define logDebug(...)
#endif

@implementation SQLitePlugin

@synthesize cachedDatabases;

-(void)pluginInitialize {
    logDebug(@"pluginInitialize()");
    cachedDatabases = [NSMutableDictionary dictionaryWithCapacity:0];
    NSString *dbDir = [self getDatabaseDir];
    [[NSFileManager defaultManager] createDirectoryAtPath: dbDir
                              withIntermediateDirectories:NO attributes: nil error:nil];
}

-(NSString*) getDatabaseDir {
    NSString *libDir = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex: 0];
    return [libDir stringByAppendingPathComponent:@"LocalDatabase"];
}

-(id) getPathForDB:(NSString *)dbName {

    // special case for in-memory databases
    if ([dbName isEqualToString:@":memory:"]) {
        return dbName;
    }
    // otherwise use this location, which matches the old SQLite Plugin behavior
    // and ensures no iCloud backup, which is apparently disallowed for SQLite dbs
    return [[self getDatabaseDir] stringByAppendingPathComponent: dbName];
}

-(NSValue*)openDatabase: (NSString*)dbName {
    logDebug(@"opening DB: %@", dbName);
    NSValue *cachedDB = [cachedDatabases objectForKey:dbName];
    if (cachedDB == nil) {
        logDebug(@"opening new db");
        NSString *fullDbPath = [self getPathForDB: dbName];
        logDebug(@"full path: %@", fullDbPath);
        const char *sqliteName = [fullDbPath UTF8String];
        sqlite3 *db;
        if (sqlite3_open(sqliteName, &db) != SQLITE_OK) {
            logDebug(@"cannot open database: %@", dbName); // shouldn't happen
        };
        cachedDB = [NSValue valueWithPointer:db];
        [cachedDatabases setObject: cachedDB forKey: dbName];
    } else {
        logDebug(@"re-using existing db");
    }
    return cachedDB;
}

-(void) exec: (CDVInvokedUrlCommand*)command {
    logDebug(@"exec()");
    [self.commandDelegate runInBackground:^{
        [self execOnBackgroundThread: command];
    }];
}

-(void) execOnBackgroundThread: (CDVInvokedUrlCommand *)command {
    logDebug(@"execOnBackgroundThread()");
    NSString *dbName = [command.arguments objectAtIndex:0];
    NSArray *sqlQueries = [command.arguments objectAtIndex:1];
    BOOL readOnly = [[command.arguments objectAtIndex:2] boolValue];
    long numQueries = [sqlQueries count];
    NSMutableDictionary *sqlResult;
    int i;
    logDebug(@"dbName: %@", dbName);
    @synchronized(self) {
        NSValue *databasePointer = [self openDatabase:dbName];
        sqlite3 *db = [databasePointer pointerValue];
        NSMutableArray *sqlResults = [NSMutableArray arrayWithCapacity:numQueries];

        // execute queries
        for (i = 0; i < numQueries; i++) {
            NSDictionary *sqlQueryObject = [sqlQueries objectAtIndex:i];
            NSString *sql = [sqlQueryObject valueForKey:@"sql"];
            NSArray *sqlArgs = [sqlQueryObject valueForKey:@"args"];
            logDebug(@"sql: %@", sql);
            logDebug(@"sqlArgs: %@", sqlArgs);
            sqlResult = [self executeSql:sql withSqlArgs:sqlArgs withDb: db withReadOnly: readOnly];
            logDebug(@"sqlResult: %@", sqlResult);
            [sqlResults addObject:sqlResult];
        }

        // send the result back to Cordova
        CDVPluginResult *pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsArray:sqlResults];
        [self.commandDelegate sendPluginResult:pluginResult callbackId: command.callbackId];
    }

}

-(NSObject*) getSqlValueForColumnType: (int)columnType withStatement: (sqlite3_stmt*)statement withIndex: (int)i {
    switch (columnType) {
        case SQLITE_INTEGER:
            return [NSNumber numberWithLongLong: sqlite3_column_int64(statement, i)];
        case SQLITE_FLOAT:
            return [NSNumber numberWithDouble: sqlite3_column_double(statement, i)];
        case SQLITE_BLOB:
        case SQLITE_TEXT:
            return [[NSString alloc] initWithBytes:(char *)sqlite3_column_text(statement, i)
                                            length:sqlite3_column_bytes(statement, i)
                                          encoding:NSUTF8StringEncoding];
    }
    return [NSNull null];
}

-(NSMutableDictionary*) executeSql: (NSString*)sql
                       withSqlArgs: (NSArray*)sqlArgs
                            withDb: (sqlite3*)db
                      withReadOnly: (BOOL)readOnly {
    logDebug(@"executeSql sql: %@", sql);
    NSString *error = nil;
    sqlite3_stmt *statement;
    NSMutableDictionary *resultSet = [NSMutableDictionary dictionaryWithCapacity:0];
    NSMutableArray *resultRows = [NSMutableArray arrayWithCapacity:0];
    NSMutableArray *entry;
    long insertId = 0;
    int rowsAffected = 0;
    int i;


    // compile the statement, throw an error if necessary
    logDebug(@"sqlite3_prepare_v2");
    if (sqlite3_prepare_v2(db, [sql UTF8String], -1, &statement, NULL) != SQLITE_OK) {
        error = [SQLitePlugin convertSQLiteErrorToString:db];
        logDebug(@"prepare error!");
        logDebug(@"error: %@", error);
        [resultSet setObject:error forKey:@"error"];
        return resultSet;
    }

    bool queryIsReadOnly = sqlite3_stmt_readonly(statement);
    if (readOnly && !queryIsReadOnly) {
        error = [NSString stringWithFormat:@"could not prepare %@", sql];
        [resultSet setObject:error forKey:@"error"];
        return resultSet;
    }

    // bind any arguments
    if (sqlArgs != nil) {
        for (i = 0; i < sqlArgs.count; i++) {
            [self bindStatement:statement withArg:[sqlArgs objectAtIndex:i] atIndex:(i + 1)];
        }
    }

    int previousRowsAffected;
    if (!queryIsReadOnly) {
        // calculate the total changes in order to diff later
        previousRowsAffected = sqlite3_total_changes(db);
    }

    // iterate through sql results
    int columnCount;
    NSMutableArray *columnNames = [NSMutableArray arrayWithCapacity:0];
    NSMutableArray *columnTypes = [NSMutableArray arrayWithCapacity:0];
    NSString *columnName;
    int columnType;
    BOOL fetchedColumns = NO;
    int result;
    NSObject *columnValue;
    BOOL hasMore = YES;
    while (hasMore) {
        logDebug(@"sqlite3_step");
        result = sqlite3_step (statement);
        switch (result) {
            case SQLITE_ROW:
                if (!fetchedColumns) {
                    // get all column names and column types once as the beginning
                    columnCount = sqlite3_column_count(statement);

                    for (i = 0; i < columnCount; i++) {
                        columnName = [NSString stringWithFormat:@"%s", sqlite3_column_name(statement, i)];
                        columnType = sqlite3_column_type(statement, i);
                        [columnNames addObject:columnName];
                        [columnTypes addObject:[NSNumber numberWithInteger:columnType]];
                    }
                    fetchedColumns = YES;
                }
                entry = [NSMutableArray arrayWithCapacity:columnCount];
                for (i = 0; i < columnCount; i++) {
                    columnType = [[columnTypes objectAtIndex:i] intValue];
                    columnValue = [self getSqlValueForColumnType:columnType withStatement:statement withIndex: i];
                    [entry addObject:columnValue];
                }
                [resultRows addObject:entry];
                break;
            case SQLITE_DONE:
                hasMore = NO;
                break;
            default:
                error = [SQLitePlugin convertSQLiteErrorToString:db];
                hasMore = NO;
                break;
        }
    }

    if (!queryIsReadOnly) {
        rowsAffected = (sqlite3_total_changes(db) - previousRowsAffected);
        if (rowsAffected > 0) {
            insertId = sqlite3_last_insert_rowid(db);
        }
    }

    logDebug(@"sqlite3_finalize");
    sqlite3_finalize (statement);

    if (error) {
        [resultSet setObject:error forKey:@"error"];
    } else {
        [resultSet setObject:resultRows forKey:@"rows"];
        [resultSet setObject:columnNames forKey:@"columns"];
        [resultSet setObject:[NSNumber numberWithInt:rowsAffected] forKey:@"rowsAffected"];
        [resultSet setObject:[NSNumber numberWithLong:insertId] forKey:@"insertId"];
    }

    logDebug(@"done executeSql sql: %@", sql);
    return resultSet;
}

-(void)bindStatement:(sqlite3_stmt *)statement withArg:(NSObject *)arg atIndex:(int)argIndex {
    if ([arg isEqual:[NSNull null]]) {
        sqlite3_bind_null(statement, argIndex);
    } else if ([arg isKindOfClass:[NSNumber class]]) {
        NSNumber *numberArg = (NSNumber *)arg;
        const char *numberType = [numberArg objCType];
        if (strcmp(numberType, @encode(int)) == 0 ||
            strcmp(numberType, @encode(long long int)) == 0) {
            sqlite3_bind_int64(statement, argIndex, [numberArg longLongValue]);
        } else if (strcmp(numberType, @encode(double)) == 0) {
            sqlite3_bind_double(statement, argIndex, [numberArg doubleValue]);
        } else {
            sqlite3_bind_text(statement, argIndex, [[arg description] UTF8String], -1, SQLITE_TRANSIENT);
        }
    } else { // NSString
        NSString *stringArg;

        if ([arg isKindOfClass:[NSString class]]) {
            stringArg = (NSString *)arg;
        } else {
            stringArg = [arg description]; // convert to text
        }

        NSData *data = [stringArg dataUsingEncoding:NSUTF8StringEncoding];
        sqlite3_bind_text(statement, argIndex, data.bytes, (int)data.length, SQLITE_TRANSIENT);
    }
}

-(void)dealloc {
    int i;
    NSArray *keys = [cachedDatabases allKeys];
    NSValue *pointer;
    NSString *key;
    sqlite3 *db;
    for (i = 0; i < [keys count]; i++) {
        key = [keys objectAtIndex:i];
        pointer = [cachedDatabases objectForKey:key];
        db = [pointer pointerValue];
        sqlite3_close (db);
    }
}

+(NSString *)convertSQLiteErrorToString:(struct sqlite3 *)db {
    int code = sqlite3_errcode(db);
    const char *cMessage = sqlite3_errmsg(db);
    NSString *message = [[NSString alloc] initWithUTF8String: cMessage];
    return [NSString stringWithFormat:@"Error code %i: %@", code, message];
}

@end