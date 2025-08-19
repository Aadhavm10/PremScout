from http.server import BaseHTTPRequestHandler
import json
import pandas as pd
import os
import urllib.parse

# Sample data for testing - replace with actual CSV reading in production
SAMPLE_DATA = {
    "gameweek": 2,
    "csv_file": "gameweek_2_predictions.csv",
    "total_players": 695,
    "filtered_players": 695,
    "last_updated": "2024-08-19 18:26:00 UTC",
    "players": [
        {
            "name": "Erling Haaland",
            "team": "Man City",
            "position": "FWD",
            "next_opponent": "Ipswich (H)",
            "fixture": "vs Ipswich",
            "predicted_points": 89.5,
            "now_cost": 15.0,
            "points_per_game": 8.5,
            "form": 9.0,
            "expected_goals": 1.2,
            "minutes": 90,
            "assists": 1,
            "goals_scored": 2,
            "yellow_cards": 0,
            "red_cards": 0,
            "saves_per_90": 0.0,
            "total_points": 17,
            "clean_sheets": 0,
            "opponent_difficulty": 2,
            "is_home": True,
            "chance_of_playing_this_round": 100,
            "image_url": "https://resources.premierleague.com/premierleague/photos/players/110x140/p223094.png"
        },
        {
            "name": "Mohamed Salah",
            "team": "Liverpool", 
            "position": "FWD",
            "next_opponent": "Brentford (A)",
            "fixture": "vs Brentford",
            "predicted_points": 82.3,
            "now_cost": 12.5,
            "points_per_game": 7.8,
            "form": 8.5,
            "expected_goals": 1.0,
            "minutes": 90,
            "assists": 2,
            "goals_scored": 1,
            "yellow_cards": 0,
            "red_cards": 0,
            "saves_per_90": 0.0,
            "total_points": 13,
            "clean_sheets": 0,
            "opponent_difficulty": 3,
            "is_home": False,
            "chance_of_playing_this_round": 100,
            "image_url": "https://resources.premierleague.com/premierleague/photos/players/110x140/p118748.png"
        },
        {
            "name": "Cole Palmer",
            "team": "Chelsea",
            "position": "MID",
            "next_opponent": "Wolves (A)", 
            "fixture": "vs Wolves",
            "predicted_points": 78.9,
            "now_cost": 10.5,
            "points_per_game": 7.2,
            "form": 8.0,
            "expected_goals": 0.8,
            "minutes": 85,
            "assists": 1,
            "goals_scored": 1,
            "yellow_cards": 0,
            "red_cards": 0,
            "saves_per_90": 0.0,
            "total_points": 11,
            "clean_sheets": 0,
            "opponent_difficulty": 3,
            "is_home": False,
            "chance_of_playing_this_round": 100,
            "image_url": "https://resources.premierleague.com/premierleague/photos/players/110x140/p491567.png"
        }
    ]
}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL and query parameters
        parsed_path = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_path.query)
        
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        # Handle different endpoints
        if parsed_path.path == '/api/predictions' or parsed_path.path == '/api/':
            # Return predictions data
            response_data = SAMPLE_DATA.copy()
            
            # Apply filtering if provided
            team = query_params.get('team', [''])[0]
            position = query_params.get('position', [''])[0] 
            search = query_params.get('search', [''])[0]
            sort_by = query_params.get('sort_by', ['predicted_points'])[0]
            sort_order = query_params.get('sort_order', ['desc'])[0]
            
            players = response_data['players']
            
            # Apply filters
            if team:
                players = [p for p in players if team.lower() in p['team'].lower()]
            if position:
                players = [p for p in players if p['position'] == position]
            if search:
                players = [p for p in players if search.lower() in p['name'].lower()]
            
            # Apply sorting
            reverse = sort_order == 'desc'
            if sort_by in ['predicted_points', 'now_cost', 'points_per_game', 'form', 'total_points']:
                players.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)
            elif sort_by in ['name', 'team', 'position']:
                players.sort(key=lambda x: x.get(sort_by, ''), reverse=reverse)
            
            response_data['players'] = players
            response_data['filtered_players'] = len(players)
            
        elif parsed_path.path == '/api/teams':
            # Return list of teams
            teams = list(set(player['team'] for player in SAMPLE_DATA['players']))
            response_data = {'teams': sorted(teams)}
            
        elif parsed_path.path == '/api/health':
            # Health check
            response_data = {'status': 'ok'}
            
        else:
            # 404 for unknown endpoints
            self.send_response(404)
            response_data = {'error': 'Not Found'}
        
        # Send the response
        self.wfile.write(json.dumps(response_data).encode())
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
