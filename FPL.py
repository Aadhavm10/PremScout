import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from datetime import datetime, timedelta
import requests
import json
import os

# Constants
FPL_BASE_URL = "https://fantasy.premierleague.com/api"
LOCAL_DATA_DIR = "./data"
HOME_ADVANTAGE_FACTOR = 1.1  # 10% bonus for home games
CURRENT_DATE = datetime.now()  # Use current date

def fetch_fpl_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Fetch data from the official FPL API and return players, fixtures, and teams dataframes."""
    print("Fetching data from FPL API...")
    
    # Fetch bootstrap-static data (players, teams, events)
    bootstrap_url = f"{FPL_BASE_URL}/bootstrap-static/"
    response = requests.get(bootstrap_url)
    response.raise_for_status()
    data = response.json()
    
    # Extract players data
    players_data = data['elements']
    players_df = pd.DataFrame(players_data)
    
    # Extract teams data
    teams_data = data['teams']
    teams_df = pd.DataFrame(teams_data)
    
    # Create team name mapping
    team_mapping = dict(zip(teams_df['id'], teams_df['name']))
    players_df['team'] = players_df['team'].map(team_mapping)
    
    # Map position codes to names
    position_mapping = {1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD'}
    players_df['position'] = players_df['element_type'].map(position_mapping)
    
    # Fetch fixtures data
    fixtures_url = f"{FPL_BASE_URL}/fixtures/"
    fixtures_response = requests.get(fixtures_url)
    fixtures_response.raise_for_status()
    fixtures_data = fixtures_response.json()
    fixtures_df = pd.DataFrame(fixtures_data)
    
    # Map team IDs to names in fixtures
    fixtures_df['home_team'] = fixtures_df['team_h'].map(team_mapping)
    fixtures_df['away_team'] = fixtures_df['team_a'].map(team_mapping)
    
    # Create difficulty dataframe from teams data
    difficulty_df = teams_df[['name', 'strength']].copy()
    difficulty_df.columns = ['Team', 'Fixture Difficulty Rating']
    # Map FPL strength (1-5) to difficulty rating (1-5, where 5 is hardest)
    difficulty_df['Fixture Difficulty Rating'] = 6 - difficulty_df['Fixture Difficulty Rating']
    
    print("FPL data fetched successfully!")
    return players_df, fixtures_df, difficulty_df

def get_current_gameweek_status():
    """Get current gameweek information from FPL API."""
    response = requests.get(f"{FPL_BASE_URL}/bootstrap-static/")
    response.raise_for_status()
    data = response.json()
    
    events = data['events']
    current_gw = next((e for e in events if e.get('is_current', False)), None)
    next_gw = next((e for e in events if e.get('is_next', False)), None)
    
    if current_gw:
        current_gw_num = current_gw['id']
        current_gw_name = current_gw['name']
        finished = current_gw.get('finished', False)
    else:
        current_gw_num = 1
        current_gw_name = "Gameweek 1"
        finished = False
    
    if next_gw:
        next_gw_num = next_gw['id']
        next_gw_name = next_gw['name']
    else:
        next_gw_num = current_gw_num + 1
        next_gw_name = f"Gameweek {next_gw_num}"
    
    print(f"Current GW: {current_gw_num} ({current_gw_name}) - Finished: {finished}")
    print(f"Next GW: {next_gw_num} ({next_gw_name})")
    
    # Determine which gameweek to predict for
    if finished:
        predict_gw = next_gw_num
        print(f"Current gameweek finished, predicting for GW{predict_gw}")
    else:
        predict_gw = next_gw_num  # Always predict for next GW
        print(f"Current gameweek in progress, predicting for next GW{predict_gw}")
    
    return predict_gw

def get_next_fixture_info(fixtures_df: pd.DataFrame, difficulty_df: pd.DataFrame, current_date: datetime = CURRENT_DATE):
    """Get fixture information for the next gameweek to predict.

    Returns a tuple of (fixture_info_by_team, target_gameweek_number).
    """
    # Get the target gameweek from FPL API status
    target_gameweek = get_current_gameweek_status()
    
    # Get fixtures for the target gameweek
    gameweek_fixtures = fixtures_df[fixtures_df['event'] == target_gameweek].copy()
    
    if gameweek_fixtures.empty:
        # Fallback: find next available gameweek with fixtures
        upcoming_fixtures = fixtures_df[
            (fixtures_df['finished'] == False) | 
            (fixtures_df['finished'].isna())
        ].copy()
        
        if not upcoming_fixtures.empty:
            target_gameweek = upcoming_fixtures['event'].min()
            gameweek_fixtures = upcoming_fixtures[upcoming_fixtures['event'] == target_gameweek]
            print(f"Fallback: Using GW{target_gameweek} with {len(gameweek_fixtures)} fixtures")
        else:
            raise ValueError("No upcoming fixtures found.")
    else:
        print(f"Found {len(gameweek_fixtures)} fixtures for target GW{target_gameweek}")

    # Create lookup dictionaries
    fixture_info = {}
    for _, row in gameweek_fixtures.iterrows():
        home_team = row['home_team']
        away_team = row['away_team']
        
        # For home team - opponent difficulty is away team's strength
        home_difficulty_series = difficulty_df[difficulty_df['Team'] == away_team]['Fixture Difficulty Rating']
        if home_difficulty_series.empty:
            home_difficulty = 3  # Default difficulty
        else:
            home_difficulty = home_difficulty_series.iloc[0]
            
        fixture_info[home_team] = {
            'opponent': away_team,
            'is_home': True,
            'difficulty': home_difficulty,
            'fixture_string': f"{home_team} (H) vs {away_team}"
        }

        # For away team - opponent difficulty is home team's strength
        away_difficulty_series = difficulty_df[difficulty_df['Team'] == home_team]['Fixture Difficulty Rating']
        if away_difficulty_series.empty:
            away_difficulty = 3  # Default difficulty
        else:
            away_difficulty = away_difficulty_series.iloc[0]
            
        fixture_info[away_team] = {
            'opponent': home_team,
            'is_home': False,
            'difficulty': away_difficulty,
            'fixture_string': f"{away_team} (A) vs {home_team}"
        }

    return fixture_info, int(target_gameweek)

def prepare_data(players_df: pd.DataFrame):
    """Prepare features and target for machine learning with improved feature engineering."""
    
    # Filter out players with minimal playing time (more realistic training data)
    active_players = players_df[players_df['minutes'] >= 45].copy()  # At least 45 minutes played
    
    if len(active_players) < 100:  # Fallback if too few players
        active_players = players_df[players_df['minutes'] > 0].copy()
    
    # Convert string fields to numeric
    numeric_fields = ['influence', 'creativity', 'threat', 'ict_index', 'expected_goals', 
                     'expected_assists', 'expected_goal_involvements', 'selected_by_percent']
    for field in numeric_fields:
        if field in active_players.columns:
            active_players[field] = pd.to_numeric(active_players[field], errors='coerce').fillna(0)
    
    # Enhanced feature engineering that improves with more gameweeks
    feature_columns = [
        # Basic stats (get more reliable with more games)
        'points_per_game', 'form_normalized', 'minutes_per_game',
        'goals_per_90', 'assists_per_90', 'bonus_per_90',
        
        # Advanced metrics (already per 90 from API)
        'influence', 'creativity', 'threat', 'ict_index',
        'expected_goals', 'expected_assists', 'expected_goal_involvements',
        
        # Position-specific features
        'clean_sheets_per_90', 'saves_per_90', 'goals_conceded_per_90',
        
        # Market indicators (become more predictive over time)
        'selected_by_percent', 'transfer_momentum', 'value_indicator',
        
        # Season progression features (improve with more data)
        'minutes_reliability', 'consistency_score', 'recent_form_trend',
        
        # Match context
        'opponent_difficulty', 'difficulty_adjustment', 'is_home',
        'chance_of_playing_next_round', 'chance_of_playing_this_round'
    ]
    
    # Create derived features
    active_players['minutes_per_game'] = active_players['minutes'] / np.maximum(active_players.get('starts', 1), 1)
    active_players['goals_per_90'] = (active_players['goals_scored'] / np.maximum(active_players['minutes'], 1) * 90).fillna(0)
    active_players['assists_per_90'] = (active_players['assists'] / np.maximum(active_players['minutes'], 1) * 90).fillna(0)
    active_players['bonus_per_90'] = (active_players['bonus'] / np.maximum(active_players['minutes'], 1) * 90).fillna(0)
    
    # Transfer momentum (recent transfer activity as % of ownership)
    selected_pct = pd.to_numeric(active_players.get('selected_by_percent', 1), errors='coerce').fillna(1)
    active_players['transfer_momentum'] = (
        (active_players.get('transfers_in_event', 0) - active_players.get('transfers_out_event', 0)) / 
        np.maximum(selected_pct, 0.1)
    ).fillna(0)
    
    # Value indicator (points per game / cost)
    active_players['value_indicator'] = (
        active_players['points_per_game'] / np.maximum(active_players['now_cost'] / 10, 0.1)
    ).fillna(0)
    
    # Season progression features (get more powerful with more gameweeks)
    total_minutes = active_players['minutes']
    
    # Minutes reliability - how consistent is their playing time?
    # Early season: based on starts, Later: actual variance in minutes
    active_players['minutes_reliability'] = np.minimum(total_minutes / 450, 1.0)  # 0-1 scale
    
    # Consistency score - how variable are their points?
    # Early season: low impact, Later: crucial for reliable players
    points_variance = active_players.get('points_per_game', 0) * 0.1  # Simple proxy early season
    active_players['consistency_score'] = 1.0 / (1.0 + points_variance)
    
    # Recent form trend - is their form improving/declining?
    # This becomes more meaningful with more data points
    current_form = pd.to_numeric(active_players.get('form', 0), errors='coerce').fillna(0)
    season_avg = active_players.get('points_per_game', 0)
    active_players['recent_form_trend'] = np.where(
        season_avg > 0,
        (current_form - season_avg) / np.maximum(season_avg, 0.1),
        0
    )
    
    # Ensure all feature columns exist
    for col in feature_columns:
        if col not in active_players.columns:
            active_players[col] = 0
    
    # Select features and handle missing values
    features = active_players[feature_columns].fillna(0)
    
    # Use points_per_game as target (more stable than total_points)
    target = active_players['points_per_game'].fillna(0)
    
    return features, target, active_players


def generate_predictions(
    current_date: datetime = CURRENT_DATE,
    save_csv: bool = True,
):
    """Generate predictions for the next gameweek using live FPL API data.

    Returns (output_df, next_gameweek, output_file_path or None)
    """
    try:
        # Load datasets from FPL API
        players_df, fixtures_df, difficulty_df = fetch_fpl_data()

        # Get fixture information for next gameweek
        fixture_info, next_gameweek = get_next_fixture_info(fixtures_df, difficulty_df, current_date=current_date)

        # Add fixture information to players DataFrame
        players_df['is_home'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('is_home', False))
        players_df['opponent'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('opponent', ''))
        players_df['opponent_difficulty'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('difficulty', 0))
        players_df['fixture'] = players_df['team'].map(lambda x: fixture_info.get(x, {}).get('fixture_string', ''))

        # Calculate difficulty adjustment with home advantage
        players_df['difficulty_adjustment'] = (6 - players_df['opponent_difficulty']) / 10
        players_df.loc[players_df['is_home'] == True, 'difficulty_adjustment'] *= HOME_ADVANTAGE_FACTOR

        # Convert numeric fields from strings and normalize form
        numeric_fields = ['form', 'now_cost', 'total_points', 'points_per_game', 'expected_goals', 
                         'minutes', 'assists', 'goals_scored', 'yellow_cards', 'red_cards',
                         'bonus', 'saves_per_90', 'clean_sheets', 'influence_rank', 'threat_rank']
        
        for field in numeric_fields:
            if field in players_df.columns:
                players_df[field] = pd.to_numeric(players_df[field], errors='coerce').fillna(0)
        
        # Normalize form
        if 'form' in players_df.columns and players_df['form'].max() and players_df['form'].max() != 0:
            max_form = players_df['form'].max()
            players_df['form_normalized'] = players_df['form'] / max_form
        else:
            players_df['form_normalized'] = 0

        # Train model with improved data
        features, target, active_players_df = prepare_data(players_df)
        
        print(f"Training on {len(features)} active players (filtered from {len(players_df)} total)")
        
        # Split data with stratification by position
        X_train, X_test, y_train, y_test = train_test_split(
            features, target, test_size=0.2, random_state=42
        )
        
        # Improved Random Forest with better hyperparameters
        model = RandomForestRegressor(
            n_estimators=200,  # More trees
            max_depth=15,      # Prevent overfitting
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1          # Use all CPU cores
        )
        model.fit(X_train, y_train)
        
        # Print model performance
        train_score = model.score(X_train, y_train)
        test_score = model.score(X_test, y_test)
        print(f"Model R² - Train: {train_score:.3f}, Test: {test_score:.3f}")
        
        # Show feature importance
        feature_importance = sorted(zip(features.columns, model.feature_importances_), 
                                   key=lambda x: x[1], reverse=True)
        print("Top 5 most important features:")
        for feature, importance in feature_importance[:5]:
            print(f"  {feature}: {importance:.3f}")

        # Prepare ALL players for prediction using same feature engineering
        # Apply same derived features to full dataset
        players_df['minutes_per_game'] = players_df['minutes'] / np.maximum(players_df.get('starts', 1), 1)
        players_df['goals_per_90'] = (players_df['goals_scored'] / np.maximum(players_df['minutes'], 1) * 90).fillna(0)
        players_df['assists_per_90'] = (players_df['assists'] / np.maximum(players_df['minutes'], 1) * 90).fillna(0)
        players_df['bonus_per_90'] = (players_df['bonus'] / np.maximum(players_df['minutes'], 1) * 90).fillna(0)
        
        # Convert selected_by_percent to numeric if it's a string
        selected_pct = pd.to_numeric(players_df.get('selected_by_percent', 1), errors='coerce').fillna(1)
        players_df['transfer_momentum'] = (
            (players_df.get('transfers_in_event', 0) - players_df.get('transfers_out_event', 0)) / 
            np.maximum(selected_pct, 0.1)
        ).fillna(0)
        
        players_df['value_indicator'] = (
            players_df['points_per_game'] / np.maximum(players_df['now_cost'] / 10, 0.1)
        ).fillna(0)
        
        # Apply same season progression features to all players
        total_minutes = players_df['minutes']
        players_df['minutes_reliability'] = np.minimum(total_minutes / 450, 1.0)
        
        points_variance = players_df.get('points_per_game', 0) * 0.1
        players_df['consistency_score'] = 1.0 / (1.0 + points_variance)
        
        current_form = pd.to_numeric(players_df.get('form', 0), errors='coerce').fillna(0)
        season_avg = players_df.get('points_per_game', 0)
        players_df['recent_form_trend'] = np.where(
            season_avg > 0,
            (current_form - season_avg) / np.maximum(season_avg, 0.1),
            0
        )
        
        # Use same feature columns as training
        feature_cols = features.columns.tolist()
        gameweek_features = players_df[feature_cols].fillna(0)

        # Make predictions
        players_df['predicted_points'] = model.predict(gameweek_features)

        # Apply post-processing adjustments and multiply by 10 for readability
        players_df['predicted_points'] = players_df['predicted_points'] * 0.6
        # FPL API returns cost in tenths (e.g., 95 = £9.5m), so divide by 10
        players_df['now_cost'] = players_df['now_cost'] / 10
        players_df['expected_goals'] = players_df.get('expected_goals', 0) * 0.6 / 10

        # Set predicted points to 0 if chance_of_playing_this_round is 0
        if 'chance_of_playing_this_round' in players_df.columns:
            players_df.loc[players_df['chance_of_playing_this_round'] == 0, 'predicted_points'] = 0

        # Prepare output DataFrame
        output_df = players_df.sort_values("predicted_points", ascending=False)

        output_file = None
        if save_csv:
            output_file = f"gameweek_{next_gameweek}_predictions.csv"
            columns_to_save = [
                "first_name", "second_name", "team", "position", "next_opponent", "fixture", "predicted_points",
                "now_cost", "points_per_game", "form", "expected_goals",
                "minutes", "assists", "goals_scored", "yellow_cards",
                "red_cards", "saves_per_90", "total_points", "clean_sheets",
                "opponent_difficulty", "is_home", 'chance_of_playing_this_round'
            ]
            
            # Handle name field (FPL API uses first_name + second_name)
            if 'first_name' in output_df.columns and 'second_name' in output_df.columns:
                output_df['name'] = output_df['first_name'] + ' ' + output_df['second_name']
                columns_to_save[0] = 'name'  # Replace first_name with name
                if 'second_name' in columns_to_save:
                    columns_to_save.remove('second_name')
            
            # Add next opponent column (same as opponent from fixture info)
            output_df['next_opponent'] = output_df['team'].map(lambda x: fixture_info.get(x, {}).get('opponent', 'No fixture'))
            
            # Drop missing columns gracefully
            columns_to_save = [c for c in columns_to_save if c in output_df.columns]
            output_df.to_csv(output_file, index=False, columns=columns_to_save)

        return output_df, next_gameweek, output_file
    except FileNotFoundError as e:
        raise FileNotFoundError("One or more required CSV files are missing. Please ensure all files are in the correct path.") from e
    except Exception as e:
        # Re-raise after logging friendly message for server usage
        print(f"An error occurred: {str(e)}")
        raise
if __name__ == "__main__":
    df, gw, out_path = generate_predictions(save_csv=True)
    print(f"Predictions for Gameweek {gw} saved to {out_path}")