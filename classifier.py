from sklearn import tree
from sklearn.naive_bayes import GaussianNB
import pandas as pd
import numpy as np
import os.path
import pickle
import sys

# Port into Node.js
# https://stackoverflow.com/questions/23450534/how-to-call-a-python-function-from-node-js

# FIXME:
# first data looks like this:
# -1,1542678276345,1,1064,1542677700000,252.8,107,145.7,0,11.1,0.1,24.7,68.8,7.3,18,48.9,114.4,0,4.7,0.4,11.5,94.4,6.5,6.840,73,0,30,1,72,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
# following look like this:
# -1,1542678364904,1,1066,1542678000000,202.5,107.6,94.7,0,12.9,0.2,31.4,31.7,8.9,18.1,58.1,65.6,0,4.5,0.5,19.6,42.7,6.9,6.940,73,0,30,1,72,0,2,2,1,1,2,1,1,1,1,2,1,2,1,2,1,1,1,2,1,2,1,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,2,1,2,2,1,,2,2,1,1
# somewhere in this formatting is the problem that is keeping them from being parsed

def get_cols():
    x_cols = [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
              17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
    y_cols = [28]
    return [x_cols, y_cols]


def train_model(data_path, model_path, model):
    [x_cols, y_cols] = get_cols()
    X = pd.read_csv(data_path, usecols=x_cols)
    Y = pd.read_csv(data_path, usecols=y_cols)
    clf = model().fit(X, Y.values.flatten())
    pickle.dump(clf, open(model_path, 'wb'))
    print('Model Saved')
    return clf


def test_model(data, model_path):
    data = data[0].split(',')
    data = [float(i) for i in data]
    clf = pickle.load(open(model_path, 'rb'))

    [x_cols, y_cols] = get_cols()
    pd_data = {'row1': data}

    X_test = pd.DataFrame.from_dict(pd_data, orient='index').ix[:, x_cols]
    Y_test = pd.DataFrame.from_dict(pd_data, orient='index').ix[:, y_cols]
    # print(Y_test)
    correct_y = Y_test.values[0][0]
    output_y = (clf.predict(X_test))[0]
    diff_y = correct_y - output_y
    # prediction = pd.Series(clf.predict(X_test))
    # output = pd.merge(pd.DataFrame(prediction), Y_test, how='left')
    # print(output_y, diff_y)
    return [output_y, diff_y]


def train_bayes():
    my_path = os.path.abspath(os.path.dirname(__file__))
    data_path = my_path + r"/data/cph_data.csv"
    model_path = my_path + r"/models/cnb.sav"
    clf = train_model(data_path, model_path, GaussianNB)
    return clf


def train_decision_tree():
    my_path = os.path.abspath(os.path.dirname(__file__))
    data_path = my_path + r"/data/cph_data.csv"
    model_path = my_path + r"/models/clf.sav"
    clf = train_model(data_path, model_path, tree.DecisionTreeClassifier)
    return clf


def test_tree(data):
    # data = ['7336,1.54209E+12,1,1302,1.54209E+12,113.9,70.7,42.9,0,2.5,0.3,21.9,0.4,3.7,18.4,46.5,15.2,0,2.7,0.6,9.2,0.4,6,6.93,72,0,15,1,68,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0']
    my_path = os.path.abspath(os.path.dirname(__file__))
    model_path = my_path + r"/models/clf.sav"
    out = test_model(data, model_path)
    return out


def test_bayes(data):
    my_path = os.path.abspath(os.path.dirname(__file__))
    model_path = my_path + r"/models/cnb.sav"
    out = test_model(data, model_path)
    return out


def train_all():
    train_bayes()
    train_decision_tree()
    return


def test_all(data):
    b_out = test_bayes(data)
    t_out = test_tree(data)
    print("Bayes, %.2f, %.2f, Tree, %.2f, %.2f" % (b_out[0], b_out[1], t_out[0], t_out[1]))
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
