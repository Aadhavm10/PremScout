import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from datetime import datetime, timedelta

import os
import kaggle

# Constants
KAGGLE_DATASET = "meraxes10/fantasy-premier-league-dataset-2024-2025"
LOCAL_DATA_DIR = "./data"
HOME_ADVANTAGE_FACTOR = 1.1  # 10% bonus for home games
CURRENT_DATE = datetime(2025, 1, 18)  # Current date for gameweek calculation

def download_latest_dataset():
    print("Checking for updates...")
    kaggle.api.dataset_download_files(KAGGLE_DATASET, path=LOCAL_DATA_DIR, unzip=True)
    print(f"Dataset updated and downloaded to {LOCAL_DATA_DIR}")

def get_next_fixture_info(fixtures_df, difficulty_df, current_date=CURRENT_DATE):
    """Get next fixture information and difficulties for all teams"""
    # Convert date column to datetime
    fixtures_df['date'] = pd.to_datetime(fixtures_df['date'])
    
    # Get next fixtures after current date
    next_fixtures = fixtures_df[fixtures_df['date'] > current_date].sort_values('date')
    next_gameweek = next_fixtures.iloc[0]['week']
    gameweek_fixtures = next_fixtures[next_fixtures['week'] == next_gameweek]
    
    # Create lookup dictionaries
    fixture_info = {}
    for _, row in gameweek_fixtures.iterrows():
        # For home team
        home_difficulty = difficulty_df[difficulty_df['Team'] == row['away']]['Fixture Difficulty Rating'].iloc[0]
        fixture_info[row['home']] = {
            'opponent': row['away'],
            'is_home': True,
            'difficulty': home_difficulty,
            'fixture_string': f"{row['home']} (H) vs {row['away']}"
        }
        
        # For away team
        away_difficulty = difficulty_df[difficulty_df['Team'] == row['home']]['Fixture Difficulty Rating'].iloc[0]
        fixture_info[row['away']] = {
            'opponent': row['home'],
            'is_home': False,
            'difficulty': away_difficulty,
            'fixture_string': f"{row['away']} (A) vs {row['home']}"
        }
    
    return fixture_info, next_gameweek

def prepare_data(players_df):
    features = players_df[[
        'now_cost', 'chance_of_playing_next_round', 'bonus',
        'influence_rank', 'threat_rank_type', 'expected_goals',
        'clean_sheets_per_90', 'points_per_game', 'form_normalized',
        'minutes', 'assists', 'goals_scored', 'yellow_cards',
        'red_cards', 'saves_per_90', 'opponent_difficulty',
        'difficulty_adjustment', 'is_home', 'chance_of_playing_this_round'
    ]]
    target = players_df['total_points']
    
    features.fillna(0, inplace=True)
    target.fillna(0, inplace=True)
    
    return features, target

# Main execution
try:
    # Load datasets
    download_latest_dataset()
    players_df = pd.read_csv("./data/players.csv")
    difficulty_df = pd.read_csv("difficulty.csv")
    fixtures_df = pd.read_csv("fixtures.csv")
    
    # Get fixture information for next gameweek
    fixture_info, next_gameweek = get_next_fixture_info(fixtures_df, difficulty_df)
    print(f"Preparing predictions for Gameweek {next_gameweek}")
    
    # Add fixture information to players DataFrame
    players_df['is_home'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('is_home', False))
    players_df['opponent'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('opponent', ''))
    players_df['opponent_difficulty'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('difficulty', 0))
    players_df['fixture'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('fixture_string', ''))
    
    # Calculate difficulty adjustment with home advantage
    players_df['difficulty_adjustment'] = (6 - players_df['opponent_difficulty']) / 10
    players_df.loc[players_df['is_home'], 'difficulty_adjustment'] *= HOME_ADVANTAGE_FACTOR
    
    # Normalize form
    max_form = players_df['form'].max()
    players_df['form_normalized'] = players_df['form'] / max_form
    
    # Train or load model

    print("Training new model...")
    features, target = prepare_data(players_df)
    X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Prepare features for prediction
    gameweek_features = players_df[[
        'now_cost', 'chance_of_playing_next_round', 'bonus',
        'influence_rank', 'threat_rank_type', 'expected_goals',
        'clean_sheets_per_90', 'points_per_game', 'form_normalized',
        'minutes', 'assists', 'goals_scored', 'yellow_cards',
        'red_cards', 'saves_per_90', 'opponent_difficulty',
        'difficulty_adjustment', 'is_home', 'chance_of_playing_this_round'
    ]].fillna(0)
    
    
    # Make predictions
    players_df['predicted_points'] = model.predict(gameweek_features)

    # Make edits
    players_df['predicted_points'] = players_df['predicted_points'] * 0.6 / 10
    players_df['now_cost'] = players_df['now_cost'] / 10
    players_df['expected_goals'] = players_df['expected_goals'] * 0.6 / 10

    #Set predicted points to 0 if chance_of_playing_this_round is 0
    players_df.loc[players_df['chance_of_playing_this_round'] == 0, 'predicted_points'] = 0


    # Prepare output DataFrame
    output_df = players_df.sort_values("predicted_points", ascending=False)
    
    # Save to CSV
    output_file = f"gameweek_{next_gameweek}_predictions.csv"
    columns_to_save = [
        "name", "team", "position", "fixture", "predicted_points",
        "now_cost", "points_per_game", "form", "expected_goals",
        "minutes", "assists", "goals_scored", "yellow_cards",
        "red_cards", "saves_per_90", "total_points", "clean_sheets",
        "opponent_difficulty", "is_home", 'chance_of_playing_this_round'
    ]
    
    output_df.to_csv(output_file, index=False, columns=columns_to_save)
    print(f"Predictions for Gameweek {next_gameweek} saved to {output_file}")

except FileNotFoundError as e:
    raise FileNotFoundError("One or more required CSV files are missing. Please ensure all files are in the correct path.") from e
except Exception as e:
    print(f"An error occurred: {str(e)}")