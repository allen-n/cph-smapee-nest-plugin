from sklearn import tree
from sklearn.naive_bayes import GaussianNB
import pandas as pd
import numpy as np
import os.path
import pickle
import sys
import csv


def get_cols(len, option='all'):
    x_cols_temp = [2, 3, 5, 21, 22, 23, 24, 25, 26, 27]
    x_cols_energy = [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                     17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
    x_cols_all = x_cols_energy
    y_cols = [28]
    i = y_cols[0] + 1
    while i < len:
        x_cols_all.append(i)
        i += 1
    x_cols = x_cols_all
    if option == 'temp':
        x_cols = x_cols_temp
    if option == 'energy':
        x_cols = x_cols_energy
    return [x_cols, y_cols]


def train_model(data_path, model_path, model, data_option='all'):
    reader = csv.reader(open(data_path))
    line = reader.next()
    [x_cols, y_cols] = get_cols(len(line), data_option)
    X = pd.read_csv(data_path, usecols=x_cols)
    Y = pd.read_csv(data_path, usecols=y_cols)
    clf = model().fit(X, Y.values.flatten())
    pickle.dump(clf, open(model_path, 'wb'))
    # print('Model Saved')
    return clf


def test_model(data, model_path, data_option='all'):
    data = data[0].split(',')
    data = [float(i) for i in data]
    clf = pickle.load(open(model_path, 'rb'))

    [x_cols, y_cols] = get_cols(len(data), data_option)
    pd_data = {'row1': data}

    X_test = pd.DataFrame.from_dict(pd_data, orient='index').ix[:, x_cols]
    Y_test = pd.DataFrame.from_dict(pd_data, orient='index').ix[:, y_cols]
    correct_y = Y_test.values[0][0]
    output_y = (clf.predict(X_test))[0]
    diff_y = correct_y - output_y

    return [output_y, diff_y]


def train_bayes(filename="cnb.sav", data_option='all'):
    my_path = os.path.abspath(os.path.dirname(__file__))
    data_path = my_path + r"/data/cph_data.csv"
    model_path = my_path + r"/models/" + filename
    clf = train_model(data_path, model_path, GaussianNB, data_option)
    return clf


def train_decision_tree(filename="clf.sav", data_option='all'):
    my_path = os.path.abspath(os.path.dirname(__file__))
    data_path = my_path + r"/data/cph_data.csv"
    model_path = my_path + r"/models/" + filename
    clf = train_model(data_path, model_path,
                      tree.DecisionTreeClassifier, data_option)
    return clf


def test_tree(data, filename="clf.sav", data_option='all'):
    my_path = os.path.abspath(os.path.dirname(__file__))
    model_path = my_path + r"/models/" + filename
    out = test_model(data, model_path, data_option)
    return out


def test_bayes(data, filename="cnb.sav", data_option='all'):
    my_path = os.path.abspath(os.path.dirname(__file__))
    model_path = my_path + r"/models/" + filename
    out = test_model(data, model_path, data_option)
    return out


# data = ['1,1542831252659,3,734,1542830700000,87.3,58.8,28.2,0,18.7,0.3,13.1,0.4,3.7,0.6,21.9,16.1,0,4.8,0.6,10.5,0.4,5.9,0.945,70,1,30,1,72,0,1,1,1,2,2,2,1,1,1,2,1,1,2,1,2,1,1,1,1,1,1,0,0,0,0,0,2,2,0,0,0,2,1,1,1,1,1,1,2,2,2,1,0,1,1,2,1,0,0,0,1,0']
# data = 38529,1542087761751,1,1302,1542087300000,113.9,70.7,42.9,0,2.5,0.3,21.9,0.4,3.7,18.4,46.5,15.2,0,2.7,0.6,9.2,0.4,6,6.930,72,0,15,1,68,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
# bad data = -1,1543282586394,1,1056,1543282200000,239.7,91.9,147.6,0,1,0.1,32,42,12.8,18.1,63,48.3,0,2.4,0.5,20.4,33.2,6.8,740,73,0,30,1,66,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
def train_all():
    sets_bayes = {"cnb-all.sav": "all",
                  "cnb-energy.sav": "energy", "cnb-temp.sav": "temp"}
    sets_tree = {"clf-all.sav": "all",
                 "clf-energy.sav": "energy", "clf-temp.sav": "temp"}
    for key, val in sets_bayes.items():
        train_bayes(key, val)
    for key, val in sets_tree.items():
        train_decision_tree(key, val)
    sys.stdout.flush()
    return


def test_all(data):
    sets_bayes = {"cnb-all.sav": "all",
                  "cnb-energy.sav": "energy", "cnb-temp.sav": "temp"}
    sets_tree = {"clf-all.sav": "all",
                 "clf-energy.sav": "energy", "clf-temp.sav": "temp"}
    b_out = {}
    t_out = {}
    out_str = ''
    for key, val in sets_bayes.items():
        b_out[val] = test_bayes(data, key, val)
    for key, val in sets_tree.items():
        t_out[val] = test_tree(data, key, val)
        out_str += "Bayes %s, %.2f, %.2f, Tree %s, %.2f, %.2f, " % (
            val, b_out[val][0], b_out[val][1], val, t_out[val][0], t_out[val][1])
    print(out_str)
    sys.stdout.flush()
    # print("Bayes, %.2f, %.2f, Tree, %.2f, %.2f" %
    #       (b_out[0], b_out[1], t_out[0], t_out[1]))
    return


def dispatcher(args):
    switch = {
        'train-tree': train_decision_tree,
        'test-tree': test_tree,
        'train-bayes': train_bayes,
        'test-bayes': test_bayes,
        'train-all': train_all,
        'test-all': test_all
    }
    func = switch.get(args[1], lambda: "Invalid Request")
    if len(args) == 2:
        func()
    else:
        func(args[2:len(args)])


if __name__ == "__main__":
    if len(sys.argv) > 1:
        dispatcher(sys.argv)
    else:
        print('No args passed')

    # print (sys.argv)
    # [x_cols, y_cols] = get_cols()

    # path = my_path + r"/data/cph_test.csv"

    # X_test = pd.read_csv(path, usecols=x_cols)
    # Y_test = pd.read_csv(path, usecols=y_cols)

    # # print(X_test)
    # prediction = pd.Series(clf.predict(X_test))
    # output = pd.DataFrame(Y_test, prediction)
    # output.to_csv(my_path + r"/data/output.csv", header=['Predictions'])
    # print(output)
