#!/usr/bin/env python3
"""
JD Agent - Garmin Connect Client

Python script that uses garminconnect library to fetch health data.
Called by TypeScript integration via subprocess.

Usage:
    python garmin-client.py login
    python garmin-client.py status
    python garmin-client.py today
    python garmin-client.py sleep [date]
    python garmin-client.py heart_rate [date]
    python garmin-client.py steps [date]
    python garmin-client.py stress [date]
    python garmin-client.py body_battery [date]
    python garmin-client.py activities [limit]
    python garmin-client.py full_report [date]

Environment variables:
    GARMIN_EMAIL - Garmin Connect email
    GARMIN_PASSWORD - Garmin Connect password
"""

import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    from garminconnect import Garmin
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "garminconnect not installed. Run: pip install garminconnect"
    }))
    sys.exit(1)

# Token storage directory
TOKEN_DIR = Path.home() / ".garminconnect"

def get_client() -> Garmin:
    """Get authenticated Garmin client."""
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    if not email or not password:
        raise ValueError("GARMIN_EMAIL and GARMIN_PASSWORD must be set")

    # Create client
    client = Garmin(email, password)

    # Try to load existing session from garth
    try:
        if TOKEN_DIR.exists():
            client.garth.load(str(TOKEN_DIR))
            # Test if session is still valid
            try:
                client.get_user_profile()
                return client
            except Exception:
                # Session expired, need to re-login
                pass
    except Exception:
        pass

    # Login and save session via garth
    client.login()
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    client.garth.dump(str(TOKEN_DIR))

    return client

def serialize_date(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def cmd_login():
    """Test login and return status."""
    try:
        client = get_client()
        profile = client.get_user_profile()
        return {
            "success": True,
            "profile": {
                "displayName": profile.get("displayName"),
                "userName": profile.get("userName"),
                "email": profile.get("email"),
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_status():
    """Get authentication status."""
    token_file = TOKEN_DIR / "session.json"
    has_session = token_file.exists()

    try:
        client = get_client()
        profile = client.get_user_profile()
        return {
            "success": True,
            "authenticated": True,
            "hasSession": has_session,
            "displayName": profile.get("displayName"),
        }
    except Exception as e:
        return {
            "success": False,
            "authenticated": False,
            "hasSession": has_session,
            "error": str(e)
        }

def cmd_today():
    """Get today's summary data."""
    try:
        client = get_client()
        today = date.today().isoformat()

        # Get various metrics
        data = {
            "date": today,
            "steps": None,
            "heartRate": None,
            "stress": None,
            "bodyBattery": None,
            "sleep": None,
        }

        try:
            stats = client.get_stats(today)
            data["steps"] = {
                "totalSteps": stats.get("totalSteps"),
                "totalDistance": stats.get("totalDistanceMeters"),
                "activeCalories": stats.get("activeKilocalories"),
                "totalCalories": stats.get("totalKilocalories"),
                "floors": stats.get("floorsAscended"),
                "activeMinutes": stats.get("activeSeconds", 0) // 60 if stats.get("activeSeconds") else None,
            }
        except Exception:
            pass

        try:
            hr = client.get_heart_rates(today)
            data["heartRate"] = {
                "restingHR": hr.get("restingHeartRate"),
                "maxHR": hr.get("maxHeartRate"),
                "minHR": hr.get("minHeartRate"),
            }
        except Exception:
            pass

        try:
            stress = client.get_stress_data(today)
            if stress:
                data["stress"] = {
                    "overallLevel": stress.get("overallStressLevel"),
                    "restStress": stress.get("restStressDuration"),
                    "lowStress": stress.get("lowStressDuration"),
                    "mediumStress": stress.get("mediumStressDuration"),
                    "highStress": stress.get("highStressDuration"),
                }
        except Exception:
            pass

        try:
            bb = client.get_body_battery(today)
            if bb and len(bb) > 0:
                latest = bb[-1] if isinstance(bb, list) else bb
                data["bodyBattery"] = {
                    "current": latest.get("bodyBatteryLevel") if isinstance(latest, dict) else None,
                    "charged": latest.get("bodyBatteryChargedValue") if isinstance(latest, dict) else None,
                    "drained": latest.get("bodyBatteryDrainedValue") if isinstance(latest, dict) else None,
                }
        except Exception:
            pass

        try:
            sleep = client.get_sleep_data(today)
            if sleep:
                data["sleep"] = {
                    "totalSleepSeconds": sleep.get("sleepTimeSeconds"),
                    "deepSleepSeconds": sleep.get("deepSleepSeconds"),
                    "lightSleepSeconds": sleep.get("lightSleepSeconds"),
                    "remSleepSeconds": sleep.get("remSleepSeconds"),
                    "awakeSleepSeconds": sleep.get("awakeSleepSeconds"),
                    "sleepScore": sleep.get("overallSleepScore", {}).get("value") if isinstance(sleep.get("overallSleepScore"), dict) else sleep.get("overallSleepScore"),
                }
        except Exception:
            pass

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_sleep(target_date=None):
    """Get sleep data for a specific date."""
    try:
        client = get_client()
        target = target_date or date.today().isoformat()

        sleep = client.get_sleep_data(target)

        if not sleep:
            return {"success": True, "data": None}

        data = {
            "date": target,
            "totalSleepSeconds": sleep.get("sleepTimeSeconds"),
            "deepSleepSeconds": sleep.get("deepSleepSeconds"),
            "lightSleepSeconds": sleep.get("lightSleepSeconds"),
            "remSleepSeconds": sleep.get("remSleepSeconds"),
            "awakeSleepSeconds": sleep.get("awakeSleepSeconds"),
            "sleepScore": sleep.get("overallSleepScore", {}).get("value") if isinstance(sleep.get("overallSleepScore"), dict) else sleep.get("overallSleepScore"),
            "sleepStartTime": sleep.get("sleepStartTimestampGMT"),
            "sleepEndTime": sleep.get("sleepEndTimestampGMT"),
        }

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_heart_rate(target_date=None):
    """Get heart rate data for a specific date."""
    try:
        client = get_client()
        target = target_date or date.today().isoformat()

        hr = client.get_heart_rates(target)

        if not hr:
            return {"success": True, "data": None}

        data = {
            "date": target,
            "restingHR": hr.get("restingHeartRate"),
            "maxHR": hr.get("maxHeartRate"),
            "minHR": hr.get("minHeartRate"),
            "avgHR": hr.get("avgHeartRate"),
        }

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_steps(target_date=None):
    """Get step data for a specific date."""
    try:
        client = get_client()
        target = target_date or date.today().isoformat()

        stats = client.get_stats(target)

        if not stats:
            return {"success": True, "data": None}

        data = {
            "date": target,
            "totalSteps": stats.get("totalSteps"),
            "stepGoal": stats.get("dailyStepGoal"),
            "totalDistance": stats.get("totalDistanceMeters"),
            "activeCalories": stats.get("activeKilocalories"),
            "totalCalories": stats.get("totalKilocalories"),
            "floors": stats.get("floorsAscended"),
            "activeMinutes": stats.get("activeSeconds", 0) // 60 if stats.get("activeSeconds") else None,
            "sedentaryMinutes": stats.get("sedentarySeconds", 0) // 60 if stats.get("sedentarySeconds") else None,
        }

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_stress(target_date=None):
    """Get stress data for a specific date."""
    try:
        client = get_client()
        target = target_date or date.today().isoformat()

        stress = client.get_stress_data(target)

        if not stress:
            return {"success": True, "data": None}

        data = {
            "date": target,
            "overallLevel": stress.get("overallStressLevel"),
            "restStressDuration": stress.get("restStressDuration"),
            "lowStressDuration": stress.get("lowStressDuration"),
            "mediumStressDuration": stress.get("mediumStressDuration"),
            "highStressDuration": stress.get("highStressDuration"),
            "stressQualifier": stress.get("stressQualifier"),
        }

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_body_battery(target_date=None):
    """Get body battery data for a specific date."""
    try:
        client = get_client()
        target = target_date or date.today().isoformat()

        bb = client.get_body_battery(target)

        if not bb:
            return {"success": True, "data": None}

        # Body battery returns a list of readings throughout the day
        if isinstance(bb, list) and len(bb) > 0:
            latest = bb[-1]
            earliest = bb[0]

            data = {
                "date": target,
                "current": latest.get("bodyBatteryLevel") if isinstance(latest, dict) else None,
                "high": max(r.get("bodyBatteryLevel", 0) for r in bb if isinstance(r, dict)),
                "low": min(r.get("bodyBatteryLevel", 100) for r in bb if isinstance(r, dict)),
                "charged": sum(r.get("bodyBatteryChargedValue", 0) for r in bb if isinstance(r, dict)),
                "drained": sum(r.get("bodyBatteryDrainedValue", 0) for r in bb if isinstance(r, dict)),
            }
        else:
            data = {
                "date": target,
                "current": bb.get("bodyBatteryLevel") if isinstance(bb, dict) else None,
            }

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_activities(limit=10):
    """Get recent activities."""
    try:
        client = get_client()

        activities = client.get_activities(0, int(limit))

        if not activities:
            return {"success": True, "data": []}

        data = []
        for activity in activities:
            data.append({
                "activityId": activity.get("activityId"),
                "activityName": activity.get("activityName"),
                "activityType": activity.get("activityType", {}).get("typeKey") if isinstance(activity.get("activityType"), dict) else activity.get("activityType"),
                "startTime": activity.get("startTimeLocal"),
                "duration": activity.get("duration"),
                "distance": activity.get("distance"),
                "calories": activity.get("calories"),
                "avgHR": activity.get("averageHR"),
                "maxHR": activity.get("maxHR"),
                "avgSpeed": activity.get("avgSpeed"),
            })

        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

def cmd_full_report(target_date=None):
    """Get comprehensive health report for a date."""
    try:
        client = get_client()
        target = target_date or date.today().isoformat()

        report = {
            "date": target,
            "steps": None,
            "heartRate": None,
            "sleep": None,
            "stress": None,
            "bodyBattery": None,
            "activities": [],
        }

        # Steps
        try:
            result = cmd_steps(target)
            if result["success"]:
                report["steps"] = result.get("data")
        except Exception:
            pass

        # Heart Rate
        try:
            result = cmd_heart_rate(target)
            if result["success"]:
                report["heartRate"] = result.get("data")
        except Exception:
            pass

        # Sleep
        try:
            result = cmd_sleep(target)
            if result["success"]:
                report["sleep"] = result.get("data")
        except Exception:
            pass

        # Stress
        try:
            result = cmd_stress(target)
            if result["success"]:
                report["stress"] = result.get("data")
        except Exception:
            pass

        # Body Battery
        try:
            result = cmd_body_battery(target)
            if result["success"]:
                report["bodyBattery"] = result.get("data")
        except Exception:
            pass

        # Activities
        try:
            activities = client.get_activities_by_date(target, target)
            if activities:
                for activity in activities[:5]:
                    report["activities"].append({
                        "activityId": activity.get("activityId"),
                        "activityName": activity.get("activityName"),
                        "activityType": activity.get("activityType", {}).get("typeKey") if isinstance(activity.get("activityType"), dict) else activity.get("activityType"),
                        "startTime": activity.get("startTimeLocal"),
                        "duration": activity.get("duration"),
                        "distance": activity.get("distance"),
                        "calories": activity.get("calories"),
                    })
        except Exception:
            pass

        return {"success": True, "data": report}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: garmin-client.py <command> [args]",
            "commands": ["login", "status", "today", "sleep", "heart_rate", "steps", "stress", "body_battery", "activities", "full_report"]
        }))
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:] if len(sys.argv) > 2 else []

    commands = {
        "login": cmd_login,
        "status": cmd_status,
        "today": cmd_today,
        "sleep": lambda: cmd_sleep(args[0] if args else None),
        "heart_rate": lambda: cmd_heart_rate(args[0] if args else None),
        "steps": lambda: cmd_steps(args[0] if args else None),
        "stress": lambda: cmd_stress(args[0] if args else None),
        "body_battery": lambda: cmd_body_battery(args[0] if args else None),
        "activities": lambda: cmd_activities(args[0] if args else 10),
        "full_report": lambda: cmd_full_report(args[0] if args else None),
    }

    if command not in commands:
        print(json.dumps({
            "success": False,
            "error": f"Unknown command: {command}",
            "commands": list(commands.keys())
        }))
        sys.exit(1)

    result = commands[command]()
    print(json.dumps(result, default=serialize_date))

if __name__ == "__main__":
    main()
