"""
Generate synthetic delivery dataset and train ML models.
Run: python -m app.ml.train
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os
import math

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

np.random.seed(42)
N = 6000


def generate_dataset():
    print("📊 Generating synthetic delivery dataset...")

    distance_km = np.random.exponential(scale=8, size=N).clip(0.5, 35)
    hour_of_day = np.random.randint(6, 22, size=N)
    day_of_week = np.random.randint(0, 7, size=N)
    package_weight = np.random.exponential(scale=2.5, size=N).clip(0.2, 30)
    agent_workload = np.random.randint(0, 10, size=N)
    traffic_level = np.random.choice([1.0, 1.5, 2.0, 2.5, 3.0], size=N,
                                      p=[0.25, 0.25, 0.25, 0.15, 0.10])
    priority = np.random.choice([0, 1, 2, 3], size=N, p=[0.3, 0.4, 0.2, 0.1])

    # Peak hour indicator
    is_peak = ((hour_of_day >= 7) & (hour_of_day <= 9)) | ((hour_of_day >= 17) & (hour_of_day <= 20))
    is_weekend = day_of_week >= 5

    # ETA calculation (minutes)
    base_speed_kmh = 25
    eta_base = (distance_km / base_speed_kmh) * 60
    eta = (
        eta_base
        * traffic_level
        * np.where(is_peak, 1.3, 1.0)
        + agent_workload * 1.5
        + package_weight * 0.3
        + np.random.normal(0, 3, N)
    ).clip(5, 180)

    # Delay risk (0=low, 1=medium, 2=high)
    delay_score = (
        (distance_km / 35) * 0.3
        + (agent_workload / 10) * 0.25
        + ((traffic_level - 1) / 2) * 0.25
        + np.where(is_peak, 0.15, 0)
        + (priority / 3) * 0.05
        + np.random.uniform(0, 0.15, N)
    )

    delay_risk = np.where(delay_score < 0.35, 0, np.where(delay_score < 0.65, 1, 2))

    df = pd.DataFrame({
        "distance_km": distance_km,
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "package_weight": package_weight,
        "agent_workload": agent_workload,
        "traffic_level": traffic_level,
        "priority_enc": priority,
        "eta_minutes": eta,
        "delay_risk": delay_risk,
    })

    return df


def train_models(df: pd.DataFrame):
    features_eta = ["distance_km", "hour_of_day", "day_of_week", "package_weight", "agent_workload", "traffic_level"]
    features_delay = ["distance_km", "hour_of_day", "day_of_week", "package_weight", "agent_workload", "traffic_level", "priority_enc"]

    X_eta = df[features_eta]
    y_eta = df["eta_minutes"]
    X_delay = df[features_delay]
    y_delay = df["delay_risk"]

    # ETA Model
    print("\n🚀 Training ETA Regression Model (Random Forest)...")
    X_train, X_test, y_train, y_test = train_test_split(X_eta, y_eta, test_size=0.2, random_state=42)
    eta_model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    eta_model.fit(X_train, y_train)
    y_pred = eta_model.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = math.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    print(f"  ✅ ETA Model — MAE: {mae:.2f} min | RMSE: {rmse:.2f} min | R²: {r2:.4f}")

    # Delay Risk Classifier
    print("\n🚀 Training Delay Risk Classifier (Random Forest)...")
    X_train2, X_test2, y_train2, y_test2 = train_test_split(X_delay, y_delay, test_size=0.2, random_state=42)
    delay_model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    delay_model.fit(X_train2, y_train2)
    y_pred2 = delay_model.predict(X_test2)

    acc = accuracy_score(y_test2, y_pred2)
    print(f"  ✅ Delay Model — Accuracy: {acc:.4f}")
    print(f"\n{classification_report(y_test2, y_pred2, target_names=['Low', 'Medium', 'High'])}")

    # Save
    eta_path = os.path.join(MODELS_DIR, "eta_model.pkl")
    delay_path = os.path.join(MODELS_DIR, "delay_model.pkl")
    joblib.dump(eta_model, eta_path)
    joblib.dump(delay_model, delay_path)
    print(f"\n💾 Models saved to {MODELS_DIR}")
    return eta_model, delay_model


if __name__ == "__main__":
    df = generate_dataset()
    print(f"Dataset shape: {df.shape}")
    print(df.describe())
    train_models(df)
    print("\n✅ Training complete!")
