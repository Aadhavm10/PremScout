import json
import os
import glob
import csv
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


def fetch_player_images(players: list) -> list:
    try:
        r = requests.get('https://fantasy.premierleague.com/api/bootstrap-static/', timeout=10)
        if r.status_code == 200:
            data = r.json()
            name_to_code = {}
            for p in data.get('elements', []):
                full_name = f"{p.get('first_name','')} {p.get('second_name','')}".strip()
                name_to_code[full_name] = p.get('code', 0)
            for pl in players:
                code = name_to_code.get(pl.get('name', ''), 0)
                pl['player_code'] = code
                pl['image_url'] = f"https://resources.premierleague.com/premierleague/photos/players/110x140/p{code}.png" if code else None
    except Exception:
        for pl in players:
            pl['player_code'] = 0
            pl['image_url'] = None
    return players


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

        with open(csv_file, newline='') as f:
            reader = csv.DictReader(f)
            players = [row for row in reader]

        try:
            gameweek = int(os.path.basename(csv_file).split('_')[1])
        except Exception:
            gameweek = 1

        numeric_fields = [
            'predicted_points', 'now_cost', 'points_per_game', 'form', 'total_points',
            'expected_goals', 'minutes', 'assists', 'goals_scored', 'yellow_cards',
            'red_cards', 'saves_per_90', 'clean_sheets', 'opponent_difficulty'
        ]
        for pl in players:
            for field in numeric_fields:
                if field in pl and pl[field] not in (None, ''):
                    try:
                        pl[field] = float(pl[field])
                    except Exception:
                        pl[field] = 0.0

        if team:
            players = [p for p in players if team.lower() in (p.get('team', '').lower())]
        if position:
            players = [p for p in players if p.get('position', '') == position]
        if search:
            players = [p for p in players if search.lower() in (p.get('name', '').lower())]

        reverse = (sort_order == 'desc')
        try:
            players.sort(key=lambda p: p.get(sort_by, 0 if sort_by in numeric_fields else ''), reverse=reverse)
        except Exception:
            pass

        players = fetch_player_images(players)
        body = {
            'gameweek': gameweek,
            'csv_file': os.path.basename(csv_file),
            'total_players': sum(1 for _ in open(csv_file)) - 1 if os.path.exists(csv_file) else 0,
            'filtered_players': len(players),
            'last_updated': get_last_updated(),
            'players': players,
        }
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': json.dumps(body)}
    except Exception as e:
        return {'statusCode': 500, 'headers': _cors_headers(), 'body': json.dumps({'error': str(e)})}


