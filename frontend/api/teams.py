import json
import os
import glob
import pandas as pd


def _cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }


def get_latest_csv():
    for pattern in ['gameweek_*_predictions.csv', '../gameweek_*_predictions.csv', '../../gameweek_*_predictions.csv', '/var/task/gameweek_*_predictions.csv']:
        try:
            files = glob.glob(pattern)
            if files:
                files.sort(key=lambda p: int(os.path.basename(p).split('_')[1]))
                return files[-1]
        except Exception:
            continue
    return None


def handler(request, context):
    try:
        method = request.get('httpMethod', 'GET')
        if method == 'OPTIONS':
            return {'statusCode': 200, 'headers': _cors_headers(), 'body': ''}

        csv_file = get_latest_csv()
        if not csv_file:
            body = {'teams': ['Arsenal', 'Chelsea', 'Liverpool', 'Man City']}
            return {'statusCode': 200, 'headers': _cors_headers(), 'body': json.dumps(body)}

        df = pd.read_csv(csv_file)
        teams = sorted(df['team'].dropna().unique().tolist())
        body = {'teams': teams}
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': json.dumps(body)}
    except Exception as e:
        return {'statusCode': 500, 'headers': _cors_headers(), 'body': json.dumps({'error': str(e)})}


