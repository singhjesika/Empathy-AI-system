
# first code

import pandas as pd
df = pd.read_csv('data.csv')
df.shape

df.describe()

df.values

# next

import pandas asa pd
music_data = pd.read_csv('music.csv')
X = music_data.drop(columns=['genre']) # drop deete the whole value and column name ' genre '
y =music_data['genre']


#next

import pandas as pd
from sclearn.tree import DecisionTreeClassifier

music_data = pd.read_csv('music.csv')
X = music_data.drop(columns=['genre'])
y =music_data['genre']

model = DecisionTreeClassifier()
model.fit(X, y)
music_data

#next

import pandas as pd
from sclearn.tree import DecisionTreeClassifier

music_data = pd.read_csv('music.csv')
X = music_data.drop(columns=['genre'])
y =music_data['genre']

model = DecisionTreeClassifier()
model.fit(X, y)
model.redict([ [ [21, 1]] , [22 , 0] ])
predictions

# How to mearsure accuracy of the Model

import pandas as pd
from sclearn.tree import DecisionTreeClassifier
from skilearn.model_selection import train_test_split

music_data = pd.read_csv('music.csv')
X = music_data.drop(columns=['genre'])
y =music_data['genre']
Xtrain, X_test , y_train , y_test = train_test_split(X ,y , test-size=0.2)

model = DecisionTreeClassifier()
model.fit(X_train, y_train)
predictions = model.predict(X_test)

score = accuracy_score(y_test , predictions)
score

# Model make Predictions

import pandas as pd
from sclearn.tree import DecisionTreeClassifier
from sklearn.externals imprt joblib

music_data = pd.read_csv('music.csv')
X = music_data.drop(columns=['genre'])
y =music_data['genre']

model = DecisionTreeClassifier()
model.fit(X, y)

joblib.dumb(modl, 'music-recommender.joblib')

# next "Modal load"

import pandas as pd
from sclearn.tree import DecisionTreeClassifier
from sklearn.externals imprt joblib

model =joblib.load('music-recomender.joblib')
predictions = model.predict([[21 ,1]])
predictions

# Export Model for Visual Format

import pandas as pd
from sclearn.tree import DecisionTreeClassifier
from sklearn.externals imprt joblib

music_data = pd.read_csv('music.csv')
X = music_data.drop(columns=['genre'])
y =music_data['genre']

model = DecisionTreeClassifier()
model.fit(X, y)

tree.export_graphicviz(model, out_file='music-recommender.dot' , feature_names=['age' , 'gender'] , class_names=sort(y.unique()), label='all', rounded=True, filled=True)





