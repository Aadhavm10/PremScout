from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
import glob

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}})

def get_latest_csv():
    """Find the most recent gameweek prediction CSV file."""
    csv_files = glob.glob("gameweek_*_predictions.csv")
    if not csv_files:
        return None
    # Sort by gameweek number (extract number from filename)
    csv_files.sort(key=lambda x: int(x.split('_')[1]), reverse=True)
    return csv_files[0]

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/api/predictions')
def get_predictions():
    try:
        # Get the latest CSV file
        latest_csv = get_latest_csv()
        if not latest_csv:
            return jsonify({'error': 'No prediction CSV files found'}), 404
        
        # Read the CSV
        df = pd.read_csv(latest_csv)
        
        # Add player images by fetching from FPL API
        try:
            import requests
            response = requests.get('https://fantasy.premierleague.com/api/bootstrap-static/')
            fpl_data = response.json()
            players_api = pd.DataFrame(fpl_data['elements'])
            
            # Create mapping from name to code for images
            players_api['full_name'] = players_api['first_name'] + ' ' + players_api['second_name']
            name_to_code = dict(zip(players_api['full_name'], players_api['code']))
            
            # Add image URLs to dataframe
            df['player_code'] = df['name'].map(name_to_code)
            df['image_url'] = df['player_code'].apply(
                lambda code: f'https://resources.premierleague.com/premierleague/photos/players/110x140/p{code}.png' 
                if pd.notna(code) else None
            )
        except:
            # Fallback if API fails
            df['player_code'] = None
            df['image_url'] = None
        
        # Extract gameweek number from filename
        gameweek = int(latest_csv.split('_')[1])
        
        # Get query parameters for filtering/sorting
        team = request.args.get('team', '')
        position = request.args.get('position', '')
        search = request.args.get('search', '')
        sort_by = request.args.get('sort_by', 'predicted_points')
        sort_order = request.args.get('sort_order', 'desc')
        limit = int(request.args.get('limit', 0))
        
        # Apply filters
        filtered_df = df.copy()
        
        if team:
            filtered_df = filtered_df[filtered_df['team'].str.contains(team, case=False, na=False)]
        
        if position:
            filtered_df = filtered_df[filtered_df['position'] == position]
        
        if search:
            # Search in player names
            mask = filtered_df['name'].str.contains(search, case=False, na=False)
            filtered_df = filtered_df[mask]
        
        # Apply sorting
        if sort_by in filtered_df.columns:
            ascending = sort_order == 'asc'
            # Handle numeric columns properly
            numeric_columns = [
                'predicted_points', 'now_cost', 'points_per_game', 'form', 'total_points', 
                'minutes', 'expected_goals', 'assists', 'goals_scored', 'yellow_cards', 
                'red_cards', 'saves_per_90', 'clean_sheets', 'opponent_difficulty', 
                'chance_of_playing_this_round'
            ]
            if sort_by in numeric_columns:
                filtered_df[sort_by] = pd.to_numeric(filtered_df[sort_by], errors='coerce')
            filtered_df = filtered_df.sort_values(sort_by, ascending=ascending, na_position='last')
        
        # Apply limit
        if limit > 0:
            filtered_df = filtered_df.head(limit)
        
        # Fill NaN values
        filtered_df = filtered_df.fillna(0)
        
        # Convert to records
        players = filtered_df.to_dict('records')
        
        return jsonify({
            'gameweek': gameweek,
            'csv_file': latest_csv,
            'total_players': len(df),
            'filtered_players': len(filtered_df),
            'players': players
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/teams')
def get_teams():
    try:
        latest_csv = get_latest_csv()
        if not latest_csv:
            return jsonify({'error': 'No prediction CSV files found'}), 404
            
        df = pd.read_csv(latest_csv)
        teams = sorted(df['team'].unique().tolist())
        return jsonify({'teams': teams})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats')
def get_stats():
    try:
        latest_csv = get_latest_csv()
        if not latest_csv:
            return jsonify({'error': 'No prediction CSV files found'}), 404
            
        df = pd.read_csv(latest_csv)
        
        # Calculate some basic stats
        stats = {
            'total_players': len(df),
            'avg_predicted_points': df['predicted_points'].mean() if 'predicted_points' in df.columns else 0,
            'max_predicted_points': df['predicted_points'].max() if 'predicted_points' in df.columns else 0,
            'positions': df['position'].value_counts().to_dict() if 'position' in df.columns else {},
            'teams': len(df['team'].unique()) if 'team' in df.columns else 0,
            'columns': df.columns.tolist()
        }
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# For Vercel deployment
def handler(request):
    return app(request)

if __name__ == '__main__':
    print("Starting CSV server...")
    latest = get_latest_csv()
    if latest:
        print(f"Serving data from: {latest}")
    else:
        print("No CSV files found!")
    app.run(debug=True, host='0.0.0.0', port=5000)
