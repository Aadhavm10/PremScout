import json
import os
import glob
import pandas as pd
import requests


def _cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }


def get_latest_csv():
    patterns = [
        'gameweek_*_predictions.csv',
        '../gameweek_*_predictions.csv',
        '../../gameweek_*_predictions.csv',
        '/var/task/gameweek_*_predictions.csv',
    ]
    for pattern in patterns:
        try:
            files = glob.glob(pattern)
            if files:
                files.sort(key=lambda p: int(os.path.basename(p).split('_')[1]))
                return files[-1]
        except Exception:
            continue
    return None


def get_last_updated():
    for path in ['last_updated.txt', '../last_updated.txt', '../../last_updated.txt', '/var/task/last_updated.txt']:
        try:
            if os.path.exists(path):
                return open(path, 'r').read().strip()
        except Exception:
            continue
    return 'Unknown'


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


def handler(request, context):
    try:
        method = request.get('httpMethod', 'GET')
        if method == 'OPTIONS':
            return {'statusCode': 200, 'headers': _cors_headers(), 'body': ''}

        qs = request.get('queryStringParameters') or {}
        sort_by = (qs.get('sort_by') or 'predicted_points')
        sort_order = (qs.get('sort_order') or 'desc')
        team = (qs.get('team') or '')
        position = (qs.get('position') or '')
        search = (qs.get('search') or '')

        csv_file = get_latest_csv()
        if not csv_file:
            # Fallback minimal sample
            body = {
                'gameweek': 1,
                'csv_file': 'sample_data.csv',
                'total_players': 2,
                'filtered_players': 2,
                'last_updated': get_last_updated(),
                'players': [
                    {'name': 'Erling Haaland', 'team': 'Man City', 'position': 'FWD', 'predicted_points': 89.5, 'now_cost': 15.0},
                    {'name': 'Mohamed Salah', 'team': 'Liverpool', 'position': 'MID', 'predicted_points': 82.3, 'now_cost': 12.5},
                ],
            }
            return {'statusCode': 200, 'headers': _cors_headers(), 'body': json.dumps(body)}

        df = pd.read_csv(csv_file)
        df = fetch_player_images(df)

        try:
            gameweek = int(os.path.basename(csv_file).split('_')[1])
        except Exception:
            gameweek = 1

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
        body = {
            'gameweek': gameweek,
            'csv_file': os.path.basename(csv_file),
            'total_players': len(pd.read_csv(csv_file)),
            'filtered_players': len(players),
            'last_updated': get_last_updated(),
            'players': players,
        }
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': json.dumps(body)}
    except Exception as e:
        return {'statusCode': 500, 'headers': _cors_headers(), 'body': json.dumps({'error': str(e)})}


