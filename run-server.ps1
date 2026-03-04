# Simple local web server for testing
# This will serve the site at http://localhost:8000

Write-Host "Starting local server at http://localhost:8000"
Write-Host "Press Ctrl+C to stop the server"
Write-Host ""

python -m http.server 8000
