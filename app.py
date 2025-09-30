
from flask import Flask, render_template, send_from_directory, jsonify
import os

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

# Serve questions as JSON (editable: static/questions.json)
@app.route("/questions")
def questions():
    return send_from_directory("static", "questions.json", mimetype="application/json")

# Health check
@app.route("/healthz")
def health():
    return jsonify({"ok": True})

if __name__ == "__main__":
    # Debug on localhost; change host for LAN access if needed
    app.run(debug=True)
