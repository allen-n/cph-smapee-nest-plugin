from sklearn import tree
import pandas as pd
import numpy as np
import os.path

# Port into Node.js
# https://stackoverflow.com/questions/23450534/how-to-call-a-python-function-from-node-js

my_path = os.path.abspath(os.path.dirname(__file__))
path = my_path + r"\data\cph_data.csv"

x_cols = [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
          17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
y_cols = [28]

X = pd.read_csv(path, usecols=x_cols)
Y = pd.read_csv(path, usecols=y_cols)

# print(X)
# print('\n')
# print(X)

clf = tree.DecisionTreeClassifier()

clf = clf.fit(X, Y)

path = my_path + r"\data\cph_test.csv"

X_test = pd.read_csv(path, usecols=x_cols)
Y_test = pd.read_csv(path, usecols=y_cols)

# print(X_test)
prediction = pd.Series(clf.predict(X_test))
output = pd.DataFrame(Y_test, prediction)
output.to_csv(my_path + r"\data\output.csv", header=['Predictions'])
print(output)
