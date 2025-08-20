from flask import Flask, request, jsonify
import pandas as pd
import os
import glob
import requests

def get_latest_csv():
    """Find the most recent gameweek predictions CSV file."""
    # Look in multiple possible locations for Vercel
    possible_paths = [
        "gameweek_*_predictions.csv",  # Current directory (api/)
        "../gameweek_*_predictions.csv",  # Parent directory
        "/var/task/gameweek_*_predictions.csv",  # Vercel serverless environment
        "../../gameweek_*_predictions.csv",  # Another level up
        "/vercel/path0/gameweek_*_predictions.csv",  # Vercel build path
    ]
    
    for pattern in possible_paths:
        try:
            csv_files = glob.glob(pattern)
            if csv_files:
                # Sort by filename to get the latest gameweek
                latest_file = sorted(csv_files, key=lambda x: int(x.split('_')[1]) if '_' in x else 0)[-1]
                return latest_file
        except Exception as e:
            print(f"Error checking pattern {pattern}: {e}")
            continue
    
    return None

def get_last_updated():
    """Get the last updated timestamp."""
    possible_paths = [
        "last_updated.txt",  # Current directory (api/)
        "../last_updated.txt", 
        "/var/task/last_updated.txt",
        "../../last_updated.txt"
    ]
    
    for path in possible_paths:
        try:
            if os.path.exists(path):
                with open(path, 'r') as f:
                    return f.read().strip()
        except:
            continue
    
    return "Unknown"

def fetch_player_images(df):
    """Fetch player codes from FPL API to construct image URLs."""
    try:
        response = requests.get('https://fantasy.premierleague.com/api/bootstrap-static/', timeout=10)
        if response.status_code == 200:
            fpl_data = response.json()
            
            # Create a mapping of player names to their codes
            name_to_code = {}
            for player in fpl_data['elements']:
                full_name = f"{player['first_name']} {player['second_name']}"
                name_to_code[full_name] = player['code']
            
            # Add image URLs to dataframe
            df['image_url'] = df['name'].apply(
                lambda name: f"https://resources.premierleague.com/premierleague/photos/players/110x140/p{name_to_code.get(name, '0')}.png"
                if name in name_to_code else None
            )
            df['player_code'] = df['name'].apply(lambda name: name_to_code.get(name, 0))
            
    except Exception as e:
        print(f"Error fetching player images: {e}")
        df['image_url'] = None
        df['player_code'] = 0
    
    return df

app = Flask(__name__)


def _build_predictions_response(query_params: dict):
    csv_file = get_latest_csv()
    if not csv_file:
        # Fallback to sample data if CSV not found
        return ({
            'gameweek': 2,
            'csv_file': 'sample_data.csv',
            'total_players': 6,
            'filtered_players': 6,
            'last_updated': get_last_updated(),
            'players': [
                {
                    'name': 'Erling Haaland', 'team': 'Man City', 'position': 'FWD',
                    'next_opponent': 'Ipswich (H)', 'fixture': 'vs Ipswich',
                    'predicted_points': 89.5, 'now_cost': 15.0, 'points_per_game': 8.95,
                    'form': 9.0, 'expected_goals': 1.2, 'minutes': 90, 'assists': 1, 'goals_scored': 2,
                    'yellow_cards': 0, 'red_cards': 0, 'saves_per_90': 0.0, 'total_points': 17,
                    'clean_sheets': 0, 'opponent_difficulty': 2, 'is_home': True,
                    'chance_of_playing_this_round': 100,
                    'image_url': 'https://resources.premierleague.com/premierleague/photos/players/110x140/p223094.png',
                    'player_code': 223094
                },
                {
                    'name': 'Mohamed Salah', 'team': 'Liverpool', 'position': 'FWD',
                    'next_opponent': 'Brentford (A)', 'fixture': 'vs Brentford',
                    'predicted_points': 82.3, 'now_cost': 12.5, 'points_per_game': 7.8,
                    'form': 8.5, 'expected_goals': 1.0, 'minutes': 90, 'assists': 2, 'goals_scored': 1,
                    'yellow_cards': 0, 'red_cards': 0, 'saves_per_90': 0.0, 'total_points': 13,
                    'clean_sheets': 0, 'opponent_difficulty': 3, 'is_home': False,
                    'chance_of_playing_this_round': 100,
                    'image_url': 'https://resources.premierleague.com/premierleague/photos/players/110x140/p118748.png',
                    'player_code': 118748
                },
                {
                    'name': 'Cole Palmer', 'team': 'Chelsea', 'position': 'MID',
                    'next_opponent': 'Wolves (A)', 'fixture': 'vs Wolves',
                    'predicted_points': 78.9, 'now_cost': 10.5, 'points_per_game': 7.2,
                    'form': 8.0, 'expected_goals': 0.8, 'minutes': 85, 'assists': 1, 'goals_scored': 1,
                    'yellow_cards': 0, 'red_cards': 0, 'saves_per_90': 0.0, 'total_points': 11,
                    'clean_sheets': 0, 'opponent_difficulty': 3, 'is_home': False,
                    'chance_of_playing_this_round': 100,
                    'image_url': 'https://resources.premierleague.com/premierleague/photos/players/110x140/p491567.png',
                    'player_code': 491567
                },
                {
                    'name': 'Bukayo Saka', 'team': 'Arsenal', 'position': 'MID',
                    'next_opponent': 'Aston Villa (H)', 'fixture': 'vs Aston Villa',
                    'predicted_points': 76.2, 'now_cost': 10.0, 'points_per_game': 6.8,
                    'form': 7.5, 'expected_goals': 0.6, 'minutes': 88, 'assists': 1, 'goals_scored': 0,
                    'yellow_cards': 0, 'red_cards': 0, 'saves_per_90': 0.0, 'total_points': 9,
                    'clean_sheets': 0, 'opponent_difficulty': 4, 'is_home': True,
                    'chance_of_playing_this_round': 100,
                    'image_url': 'https://resources.premierleague.com/premierleague/photos/players/110x140/p491582.png',
                    'player_code': 491582
                },
                {
                    'name': 'Virgil van Dijk', 'team': 'Liverpool', 'position': 'DEF',
                    'next_opponent': 'Brentford (A)', 'fixture': 'vs Brentford',
                    'predicted_points': 65.4, 'now_cost': 6.0, 'points_per_game': 5.8,
                    'form': 6.5, 'expected_goals': 0.2, 'minutes': 90, 'assists': 0, 'goals_scored': 0,
                    'yellow_cards': 0, 'red_cards': 0, 'saves_per_90': 0.0, 'total_points': 8,
                    'clean_sheets': 1, 'opponent_difficulty': 3, 'is_home': False,
                    'chance_of_playing_this_round': 100,
                    'image_url': 'https://resources.premierleague.com/premierleague/photos/players/110x140/p134006.png',
                    'player_code': 134006
                },
                {
                    'name': 'Alisson', 'team': 'Liverpool', 'position': 'GKP',
                    'next_opponent': 'Brentford (A)', 'fixture': 'vs Brentford',
                    'predicted_points': 52.1, 'now_cost': 5.5, 'points_per_game': 4.2,
                    'form': 5.0, 'expected_goals': 0.0, 'minutes': 90, 'assists': 0, 'goals_scored': 0,
                    'yellow_cards': 0, 'red_cards': 0, 'saves_per_90': 3.2, 'total_points': 6,
                    'clean_sheets': 1, 'opponent_difficulty': 3, 'is_home': False,
                    'chance_of_playing_this_round': 100,
                    'image_url': 'https://resources.premierleague.com/premierleague/photos/players/110x140/p116695.png',
                    'player_code': 116695
                }
            ]
        })

    # Read CSV and build response
    df = pd.read_csv(csv_file)
    df = fetch_player_images(df)

    # Extract gameweek from filename
    gameweek = 1
    try:
        gameweek = int(os.path.basename(csv_file).split('_')[1])
    except Exception:
        pass

    # Query params
    team = (query_params.get('team') or '').strip()
    position = (query_params.get('position') or '').strip()
    search = (query_params.get('search') or '').strip()
    sort_by = (query_params.get('sort_by') or 'predicted_points').strip()
    sort_order = (query_params.get('sort_order') or 'desc').strip()

    # Filters
    if team:
        df = df[df['team'].str.contains(team, case=False, na=False)]
    if position:
        df = df[df['position'] == position]
    if search:
        df = df[df['name'].str.contains(search, case=False, na=False)]

    # Numeric columns for sorting
    numeric_columns = [
        'predicted_points', 'now_cost', 'points_per_game', 'form', 'total_points',
        'expected_goals', 'minutes', 'assists', 'goals_scored', 'yellow_cards',
        'red_cards', 'saves_per_90', 'clean_sheets', 'opponent_difficulty'
    ]
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # Sorting
    if sort_by in df.columns:
        ascending = sort_order == 'asc'
        df = df.sort_values(by=sort_by, ascending=ascending)

    players = df.to_dict('records')
    return ({
        'gameweek': gameweek,
        'csv_file': os.path.basename(csv_file),
        'total_players': len(pd.read_csv(csv_file)),
        'filtered_players': len(players),
        'last_updated': get_last_updated(),
        'players': players
    })


def _build_teams_response():
    csv_file = get_latest_csv()
    if not csv_file:
        return {'teams': ['Arsenal', 'Chelsea', 'Liverpool', 'Man City']}
    df = pd.read_csv(csv_file)
    teams = sorted(df['team'].dropna().unique().tolist())
    return {'teams': teams}

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health():
    if request.method == 'OPTIONS':
        return ('', 200)
    return jsonify({'status': 'ok'})


@app.route('/api/teams', methods=['GET', 'OPTIONS'])
def teams():
    if request.method == 'OPTIONS':
        return ('', 200)
    try:
        data = _build_teams_response()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predictions', methods=['GET', 'OPTIONS'])
def predictions():
    if request.method == 'OPTIONS':
        return ('', 200)
    try:
        qp = {
            'team': request.args.get('team', ''),
            'position': request.args.get('position', ''),
            'search': request.args.get('search', ''),
            'sort_by': request.args.get('sort_by', 'predicted_points'),
            'sort_order': request.args.get('sort_order', 'desc')
        }
        data = _build_predictions_response(qp)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Vercel detects `app` as the WSGI entrypoint
