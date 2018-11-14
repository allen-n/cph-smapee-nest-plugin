const tf = require('@tensorflow/tfjs');
const fs = require('fs');
var csv = require("fast-csv");
// Load the binding:
require('@tensorflow/tfjs-node');  // Use '@tensorflow/tfjs-node-gpu' if running with GPU.

function csv_to_arr(callback, path_to_csv = '/data/cph_data.csv') {
  var data_obj = [];
  var i = 0;
  csv
    .fromPath(__dirname + path_to_csv)
    .on('data', (data) => {
      data_obj[i] = data;
      i++;
    })
    .on('end', () => {
      // console.log(data_obj.length); //# rows
      // console.log(data_obj[0].length); //# columns
      callback(data_obj);
    });
}

function arr_to_xy(arr, indices = { not_x: [0, 1, 4, 28], y: [28] }) {
  let not_x = new Set(indices.not_x);
  let ys = new Set(indices.y);
  var x = [];
  var y = [];
  var x_arr = [];
  var y_arr = [];
  arr = zero_pad(arr);
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr[i].length; j++) {
      if (!not_x.has(j)) {
        x_arr.push(arr[i][j]);
      }
      if (ys.has(j)) {
        y_arr.push(arr[i][j]);
      }
    }
    x.push(x_arr);
    y.push(y_arr);
    x_arr = [];
    y_arr = [];
  }
  return [x, y];
}

function zero_pad(arr) {
  // zero padding
  const row_len = arr[arr.length - 1].length;
  for (let i = 0; i < arr.length; i++) {
    while (arr[i].length < row_len) {
      arr[i].push(0);
    }
  }
  return arr;
}

function arr_to_tensor(arr) {
  // making tensor
  const shape = [arr.length, arr[0].length];
  const tensor = tf.tensor(arr, shape);
  tensor.print();
}
// https://js.tensorflow.org/tutorials/tfjs-layers-for-keras-users.html
csv_to_arr((arr) => {
  let xs, ys;
  [xs, ys] = arr_to_xy(arr);
  // console.log(xs)
  arr_to_tensor(xs);
  arr_to_tensor(ys);
  // var model = tf.sequential()
});



// Train a simple model:
// const model = tf.sequential();
// model.add(tf.layers.dense({units: 100, activation: 'relu', inputShape: [10]}));
// model.add(tf.layers.dense({units: 1, activation: 'linear'}));
// model.compile({optimizer: 'sgd', loss: 'meanSquaredError'});

// const xs = tf.randomNormal([100, 10]);
// const ys = tf.randomNormal([100, 1]);

// model.fit(xs, ys, {
//   epochs: 100,
//   callbacks: {
//     onEpochEnd: async (epoch, log) => {
//       console.log(`Epoch ${epoch}: loss = ${log.loss}`);
//     }
//   }
// });