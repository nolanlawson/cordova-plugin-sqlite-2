export function map(arr, fun) {
  var len = arr.length;
  var res = Array(len);
  for (var i = 0; i < len; i++) {
    res[i] = fun(arr[i], i);
  }
  return res;
}

export function zipObject(props, values) {
  var res = {};
  var len = Math.min(props.length, values.length);
  for (var i = 0; i < len; i++) {
    res[props[i]] = values[i];
  }
  return res;
}