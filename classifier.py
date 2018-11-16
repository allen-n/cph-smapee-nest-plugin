from sklearn import tree
import pandas as pd
import numpy as np
import os.path
import pickle
import sys

# Port into Node.js
# https://stackoverflow.com/questions/23450534/how-to-call-a-python-function-from-node-js


def get_cols():
    x_cols = [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
              17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
    y_cols = [28]
    return [x_cols, y_cols]


def train_decision_tree():
    my_path = os.path.abspath(os.path.dirname(__file__))
    data_path = my_path + r"\data\cph_data.csv"
    model_path = my_path + r"\models\clf.sav"
    [x_cols, y_cols] = get_cols()
    X = pd.read_csv(data_path, usecols=x_cols)
    Y = pd.read_csv(data_path, usecols=y_cols)

    clf = tree.DecisionTreeClassifier()

    clf = clf.fit(X, Y)

    pickle.dump(clf, open(model_path, 'wb'))
    print('Model Saved')
    return clf


def test_tree(data):
    # data = ['7336,1.54209E+12,1,1302,1.54209E+12,113.9,70.7,42.9,0,2.5,0.3,21.9,0.4,3.7,18.4,46.5,15.2,0,2.7,0.6,9.2,0.4,6,6.93,72,0,15,1,68,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0']
    data = data[0].split(',')
    data = [float(i) for i in data]
    my_path = os.path.abspath(os.path.dirname(__file__))
    model_path = my_path + r"\models\clf.sav"
    clf = pickle.load(open(model_path, 'rb'))

    [x_cols, y_cols] = get_cols()
    pd_data = {'row1': data}

    X_test = pd.DataFrame.from_dict(pd_data, orient='index').ix[:, x_cols]
    Y_test = pd.DataFrame.from_dict(pd_data, orient='index').ix[:, y_cols]
    print(Y_test)
    prediction = pd.Series(clf.predict(X_test))
    # output = pd.merge(pd.DataFrame(prediction), Y_test, how='left')
    print(output)
    return


def dispatcher(args):
    switch = {
        'train-tree': train_decision_tree,
        'test-tree': test_tree
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

    # path = my_path + r"\data\cph_test.csv"

    # X_test = pd.read_csv(path, usecols=x_cols)
    # Y_test = pd.read_csv(path, usecols=y_cols)

    # # print(X_test)
    # prediction = pd.Series(clf.predict(X_test))
    # output = pd.DataFrame(Y_test, prediction)
    # output.to_csv(my_path + r"\data\output.csv", header=['Predictions'])
    # print(output)
