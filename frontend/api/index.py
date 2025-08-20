from flask import Flask, request, jsonify
import pandas as pd
import os
import glob
import requests


def get_latest_csv():
    possible_paths = [
        "gameweek_*_predictions.csv",              # current dir (frontend/api)
        "../gameweek_*_predictions.csv",          # frontend/
        "../../gameweek_*_predictions.csv",       # repo root
        "/var/task/gameweek_*_predictions.csv",   # vercel runtime
    ]
    for pattern in possible_paths:
        try:
            csv_files = glob.glob(pattern)
            if csv_files:
                latest_file = sorted(csv_files, key=lambda x: int(os.path.basename(x).split('_')[1]))[-1]
                return latest_file
        except Exception:
            continue
    return None


def get_last_updated():
    possible_paths = [
        "last_updated.txt",
        "../last_updated.txt",
        "../../last_updated.txt",
        "/var/task/last_updated.txt",
    ]
    for path in possible_paths:
        try:
            if os.path.exists(path):
                with open(path, 'r') as f:
                    return f.read().strip()
        except Exception:
            continue
    return "Unknown"


def fetch_player_images(df: pd.DataFrame) -> pd.DataFrame:
    try:
        r = requests.get('https://fantasy.premierleague.com/api/bootstrap-static/', timeout=10)
        if r.status_code == 200:
            data = r.json()
            name_to_code = {}
            for p in data.get('elements', []):
                full_name = f"{p.get('first_name','')} {p.get('second_name','')}".strip()
                name_to_code[full_name] = p.get('code', 0)
            df['player_code'] = df['name'].map(lambda n: name_to_code.get(n, 0))
            df['image_url'] = df['player_code'].map(
                lambda c: f"https://resources.premierleague.com/premierleague/photos/players/110x140/p{c}.png" if c else None
            )
    except Exception:
        df['player_code'] = 0
        df['image_url'] = None
    return df


app = Flask(__name__)


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
    csv_file = get_latest_csv()
    if not csv_file:
        return jsonify({'teams': ['Arsenal', 'Chelsea', 'Liverpool', 'Man City']})
    df = pd.read_csv(csv_file)
    teams = sorted(df['team'].dropna().unique().tolist())
    return jsonify({'teams': teams})


@app.route('/api/predictions', methods=['GET', 'OPTIONS'])
def predictions():
    if request.method == 'OPTIONS':
        return ('', 200)

    csv_file = get_latest_csv()
    if not csv_file:
        return jsonify({
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
                }
            ]
        })

    df = pd.read_csv(csv_file)
    df = fetch_player_images(df)

    try:
        gameweek = int(os.path.basename(csv_file).split('_')[1])
    except Exception:
        gameweek = 1

    team = request.args.get('team', '')
    position = request.args.get('position', '')
    search = request.args.get('search', '')
    sort_by = request.args.get('sort_by', 'predicted_points')
    sort_order = request.args.get('sort_order', 'desc')

    if team:
        df = df[df['team'].str.contains(team, case=False, na=False)]
    if position:
        df = df[df['position'] == position]
    if search:
        df = df[df['name'].str.contains(search, case=False, na=False)]

    numeric_columns = [
        'predicted_points', 'now_cost', 'points_per_game', 'form', 'total_points',
        'expected_goals', 'minutes', 'assists', 'goals_scored', 'yellow_cards',
        'red_cards', 'saves_per_90', 'clean_sheets', 'opponent_difficulty'
    ]
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    if sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=(sort_order == 'asc'))

    players = df.to_dict('records')
    return jsonify({
        'gameweek': gameweek,
        'csv_file': os.path.basename(csv_file),
        'total_players': len(pd.read_csv(csv_file)),
        'filtered_players': len(players),
        'last_updated': get_last_updated(),
        'players': players
    })


