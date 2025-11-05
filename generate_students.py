import json
import random
import string

students = []

for i in range(1, 31):
    name = random.choice(["Amit", "Neha", "Rohan", "Priya", "Siddharth", "Ananya", "Rahul", "Simran", "Karan", "Isha"]) \
           + " " + random.choice(["Sharma", "Kumar", "Verma", "Singh", "Gupta", "Patel"])
    email = name.replace(" ", ".").lower() + "@example.com"
    token = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    paid = random.choice([True, False])  # Randomly paid/unpaid
    students.append({
        "id": i,
        "name": name,
        "email": email,
        "token": token,
        "status": "Not Scanned",
        "paid": paid
    })

with open("students.json", "w") as f:
    json.dump(students, f, indent=4)

print(" Generated 30 random students with paid/unpaid status in students.json")
