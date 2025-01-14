import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import joblib

import os
import kaggle

# Define the Kaggle dataset and local storage path
KAGGLE_DATASET = "meraxes10/fantasy-premier-league-dataset-2024-2025"
LOCAL_DATA_DIR = "./data"

# Ensure the local data directory exists
os.makedirs(LOCAL_DATA_DIR, exist_ok=True)

# Function to download the latest dataset
def download_latest_dataset():
    print("Checking for updates...")
    kaggle.api.dataset_download_files(KAGGLE_DATASET, path=LOCAL_DATA_DIR, unzip=True)

    print(f"Dataset updated and downloaded to {LOCAL_DATA_DIR}")





from datetime import datetime #find gameweek

# Load the fixtures dataset
fixtures_path = "epl-fixtures-2025.csv"  # Update this path as needed
fixtures_df = pd.read_csv(fixtures_path)

# Ensure the date column is in datetime format
fixtures_df['date'] = pd.to_datetime(fixtures_df['date'])

# Get today's date
today = datetime.today()

# Determine the current gameweek based on today's date
current_gameweek = fixtures_df[fixtures_df['date'] >= today].iloc[0]['week'] if not fixtures_df[fixtures_df['date'] >= today].empty else None

if current_gameweek:
    print(f"Current Gameweek: {current_gameweek}")
else:
    print("No upcoming gameweeks found. The season may have ended.")




# Run the update function
download_latest_dataset()

# Load datasets
try:
    players_df = pd.read_csv("./data/players.csv")
    difficulty_df = pd.read_csv("premier_league_difficulty.csv")
    fixtures_df = pd.read_csv("epl-fixtures-2025.csv")
except FileNotFoundError as e:
    raise FileNotFoundError("One or more required CSV files are missing. Please ensure all files are in the correct path.") from e

# Display all players in players.csv
print("All players in players.csv:")
print(players_df)
print(f"Total number of players: {players_df.shape[0]}")

# Filter fixtures for Gameweek 21
gameweek = 21
fixtures_gw21 = fixtures_df[fixtures_df['week'] == gameweek]

# Merge fixture difficulty with fixture data
fixtures_gw21 = fixtures_gw21.merge(
    difficulty_df.rename(columns={"Team": "home", "Fixture Difficulty Rating": "home_difficulty"}),
    how="left",
    on="home"
)

fixtures_gw21 = fixtures_gw21.merge(
    difficulty_df.rename(columns={"Team": "away", "Fixture Difficulty Rating": "away_difficulty"}),
    how="left",
    on="away"
)

# Calculate opponent difficulty for each team
team_difficulties = {}
for _, row in fixtures_gw21.iterrows():
    # Home team faces away team's difficulty rating
    team_difficulties[row['home']] = row['away_difficulty']
    # Away team faces home team's difficulty rating
    team_difficulties[row['away']] = row['home_difficulty']

# Add opponent difficulty to players DataFrame
players_df['opponent_difficulty'] = players_df['team'].map(team_difficulties)

# Adjust difficulty adjustment factor (less aggressive scaling)
players_df['difficulty_adjustment'] = (6 - players_df['opponent_difficulty']) / 10  # Scale less aggressively

# Normalize form
max_form = players_df['form'].max()
players_df['form_normalized'] = players_df['form'] / max_form  # Scale between 0 and 1

# Prepare data for AI model with difficulty features
def prepare_data(players_df):
    features = players_df[[
        'now_cost', 'chance_of_playing_next_round', 'bonus',
        'influence_rank', 'threat_rank_type', 'expected_goals',
        'clean_sheets_per_90', 'points_per_game', 'form_normalized',
        'minutes', 'assists', 'goals_scored', 'yellow_cards',
        'red_cards', 'saves_per_90', 'opponent_difficulty',
        'difficulty_adjustment'
    ]]
    target = players_df['total_points']
    
    # Handle missing values
    features.fillna(0, inplace=True)
    target.fillna(0, inplace=True)

    return features, target

features, target = prepare_data(players_df)

# Train or load a RandomForestRegressor model
model_file = "fpl_model_with_difficulty.joblib"
try:
    model = joblib.load(model_file)
    print(f"Model loaded from {model_file}")
except FileNotFoundError:
    print("No pre-trained model found. Training a new model...")
    X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    joblib.dump(model, model_file)
    print(f"Model saved to {model_file}")

# Check feature importance
importances = model.feature_importances_
feature_names = features.columns
importance_df = pd.DataFrame({'Feature': feature_names, 'Importance': importances})
importance_df = importance_df.sort_values('Importance', ascending=False)
print("Feature Importances:")
print(importance_df)

# Predict and evaluate
X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)
predictions = model.predict(X_test)
mae = mean_absolute_error(y_test, predictions)
print(f"Mean Absolute Error: {mae}")

# Use model to predict Gameweek 21 player points
gameweek_players = players_df.copy()
gameweek_features = gameweek_players[[
    'now_cost', 'chance_of_playing_next_round', 'bonus',
    'influence_rank', 'threat_rank_type', 'expected_goals',
    'clean_sheets_per_90', 'points_per_game', 'form_normalized',
    'minutes', 'assists', 'goals_scored', 'yellow_cards',
    'red_cards', 'saves_per_90', 'opponent_difficulty',
    'difficulty_adjustment'
]].fillna(0)

# Make base predictions
gameweek_players['predicted_points'] = model.predict(gameweek_features)

gameweek_players['predicted_points'] = gameweek_players['predicted_points'] / 10
scaling_factor = 0.6
gameweek_players['predicted_points'] = gameweek_players['predicted_points'] * scaling_factor
gameweek_players['expected_goals'] = gameweek_players['expected_goals'] / 10


# Sort players by predicted points
all_players = gameweek_players.sort_values("predicted_points", ascending=False)

# Output all players to CSV with new columns
output_file = "gameweek_predictions_with_difficulty.csv"
all_players.to_csv(output_file, index=False, columns=[
    "name", "team", "position", "predicted_points",
    "now_cost", "points_per_game",
    "form", "expected_goals", "minutes", "assists", "goals_scored",
    "yellow_cards", "red_cards", "saves_per_90", "total_points", "clean_sheets"
])

print(f"All FPL Players Predictions for Gameweek 21 saved to {output_file}")
