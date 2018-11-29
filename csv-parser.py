import os.path
import sys
import math
import pandas as pd


def col_rms(data_frame, column_name):
    return math.sqrt((data_frame[column_name]**2).mean())


def get_efficiency(args=[]):
    '''
    pass -v or --verbose in args to {python csv-parser.py args} to 
    display names of output data categories
    '''
    if(('-v' in args) or ('--verbose' in args)):
        verbose = True
    else:
        verbose = False
    my_path = os.path.abspath(os.path.dirname(__file__))
    data_path = my_path + r"/data/ML_predictions.csv"
    cols = ['t1', 'bayes_cmd_energy', 'bayes_diff_energy',
            't2', 'tree_cmd_energy', 'tree_diff_energy',
            't3', 'bayes_cmd_temp', 'bayes_diff_temp',
            't4', 'tree_cmd_temp', 'tree_diff_temp',
            't5', 'bayes_cmd_all', 'bayes_diff_all',
            't6', 'tree_cmd_all', 'tree_diff_all'
            ]
    names = cols
    names.insert(0, 'timestamp')
    df = pd.read_csv(data_path, names=names, usecols=cols)
    out_str = ''
    for col in cols:
        if(col.__contains__('diff')):
            if verbose:
                out_str += "%s,%.2f," % (col, col_rms(df, col))
            else:
                out_str += "%.2f," % (col_rms(df, col))

    print(out_str)
    return


def dispatcher(args):
    switch = {
        'get-effic': get_efficiency
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
