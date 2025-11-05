from flask import Flask, render_template, request, jsonify, redirect, url_for, session
import qrcode, json, os
from functools import wraps

app = Flask(__name__)
app.secret_key = "supersecretkey"  # Required for session management

DATA_FILE = "students.json"

# ----------------- Admin Credentials -----------------
ADMIN_USERNAME = "GNU2025"
ADMIN_PASSWORD = "8688040903"

# ----------------- Data Handling -----------------
def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

# ----------------- Login Required Decorator -----------------
def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("admin_login"))
        return func(*args, **kwargs)
    return wrapper

# ----------------- Admin Login -----------------
@app.route("/admin", methods=["GET", "POST"])
def admin_login():
    error = None
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["logged_in"] = True
            return redirect(url_for("home"))
        else:
            error = "Invalid username or password"
    return render_template("admin_login.html", error=error)

# ----------------- Logout -----------------
@app.route("/logout")
@login_required
def logout():
    session.pop("logged_in", None)
    return redirect(url_for("admin_login"))

# ----------------- Home / Admin Dashboard -----------------
@app.route("/")
@login_required
def home():
    students = load_data()
    return render_template("home.html", students=students)

# ----------------- Generate Student QR -----------------
@app.route("/generate_qr")
@login_required
def generate_qr():
    data = load_data()
    os.makedirs("static/qrcodes", exist_ok=True)
    count = 0

    base_url = os.getenv("BASE_URL", request.host_url.rstrip("/"))

    for s in data:
        if s.get("paid"):
            url = f"{base_url}/ticket/{s['token']}"
            img = qrcode.make(url)
            img.save(f"static/qrcodes/{s['token']}.png")
            count += 1
    return f"QR codes generated for {count} paid students."

# ----------------- Student Ticket -----------------
@app.route("/ticket/<token>")
def ticket(token):
    data = load_data()
    student = next((s for s in data if s["token"] == token), None)
    if not student:
        return "Invalid ticket"
    return render_template("ticket.html", student=student)

# ----------------- Verify Entry/Exit -----------------
@app.route("/api/verify")
def verify():
    token = request.args.get("token")
    data = load_data()
    student = next((s for s in data if s["token"] == token), None)
    if not student:
        return jsonify({"status": "error", "message": "Invalid QR"})
    if student["status"] == "outside":
        student["status"] = "inside"
        msg = f"Entry allowed for {student['name']}"
    else:
        student["status"] = "outside"
        msg = f"Exit recorded for {student['name']}"
    save_data(data)
    return jsonify({"status": "success", "message": msg})

# ----------------- QR Scanner Page -----------------
@app.route("/scanner")
@login_required
def scanner():
    return render_template("scanner.html")

# ----------------- Generate Lunch QR -----------------
@app.route("/generate_lunch_qr")
@login_required
def generate_lunch_qr():
    data = load_data()
    os.makedirs("static/lunch_qrcodes", exist_ok=True)
    count = 0

    base_url = os.getenv("BASE_URL", request.host_url.rstrip("/"))

    for s in data:
        if s.get("paid"):
            lunch_token = f"lunch_{s['token']}"
            url = f"{base_url}/lunch_ticket/{lunch_token}"
            img = qrcode.make(url)
            img.save(f"static/lunch_qrcodes/{lunch_token}.png")
            s['lunch_token'] = lunch_token
            if 'lunch_scanned' not in s:
                s['lunch_scanned'] = False
            count += 1
    save_data(data)
    return f"Lunch QR codes generated for {count} students."

# ----------------- Lunch Ticket Page -----------------
@app.route("/lunch_ticket/<lunch_token>")
def lunch_ticket(lunch_token):
    data = load_data()
    student = next((s for s in data if s.get("lunch_token") == lunch_token), None)
    if not student:
        return "Invalid lunch ticket"
    return render_template("lunch_ticket.html", student=student)

# ----------------- Verify Lunch -----------------
@app.route("/api/verify_lunch")
def verify_lunch():
    lunch_token = request.args.get("token")
    data = load_data()
    student = next((s for s in data if s.get("lunch_token") == lunch_token), None)
    if not student:
        return jsonify({"status": "error", "message": "Invalid lunch QR"})
    if student.get("lunch_scanned"):
        return jsonify({"status": "error", "message": "Lunch already claimed"})
    student["lunch_scanned"] = True
    save_data(data)
    return jsonify({"status": "success", "message": f"Lunch claimed for {student['name']}"})

# ----------------- Run App -----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "True").lower() in ("1", "true", "yes")
    app.run(host=host, port=port, debug=debug)

