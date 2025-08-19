"""
Vercel serverless function for FPL predictions API
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from csv_server import app

# Vercel expects a handler function
def handler(request, response):
    return app(request, response)
