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
  var row_len = 0; // arr[arr.length - 1].length;
  arr.forEach(element => {
    if (element.length > row_len) {
      row_len = element.length
    }
  });
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < row_len; j++) {
      if (arr[i][j] == '' || typeof arr[i][j] == 'undefined') {
        arr[i][j] = '0';
      }
    }
  }
  return arr;
}

function arr_to_tensor(arr) {
  // making tensor
  const shape = [arr.length, arr[0].length];
  const tensor = tf.tensor(arr, shape);
  // tensor.print();
  return tensor;
}

async function gen_model(xs, ys, shape) {
  let x = arr_to_tensor(xs);
  let y = arr_to_tensor(ys);
  const model = tf.sequential()
  console.log(shape)
  model.add(tf.layers.dense({ units: 1, inputShape: shape }));
  model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });

  // Generate some synthetic data for training.
  // const xs = tf.tensor2d([[1], [2], [3], [4]], [4, 1]);
  // const ys = tf.tensor2d([[1], [3], [5], [7]], [4, 1]);

  // Train model with fit().
  await model.fit(x, y, { epochs: 10 }).catch((error) => {
    console.log(error)
  });
  console.log("done!")

  // Run inference with predict().
  // model.predict(tf.tensor2d([[5]], [1, 1])).print();
}
// https://js.tensorflow.org/tutorials/tfjs-layers-for-keras-users.html

csv_to_arr((arr) => {
  let xs, ys;
  [xs, ys] = arr_to_xy(arr);
  gen_model(xs, ys, [xs[0].length]);
  // console.log(xs)

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