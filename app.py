from flask import Flask, render_template, request, jsonify
import json
from logics.logic1 import execute_logic1  # Import our Python logic for Logic 1
from logics.logic2 import execute_logic2  # Import our Python logic for Logic 2
from logics.logic3 import execute_logic3  # Add this import for Logic 3

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_info():
    if 'file' not in request.files:
        print("UPLOAD: No file provided.")
        return jsonify({'status': 'error', 'message': 'No file provided.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        print("UPLOAD: No file selected.")
        return jsonify({'status': 'error', 'message': 'No file selected.'}), 400
    
    try:
        print("UPLOAD: Received file:", file.filename)
        content = file.read().decode('utf-8')
        data = json.loads(content)
        
        # Validate recordedTimes
        if "recordedTimes" not in data or not isinstance(data["recordedTimes"], list):
            print("UPLOAD: JSON file does not contain valid 'recordedTimes' key.")
            return jsonify({
                'status': 'error', 
                'message': 'JSON file must contain "recordedTimes" as a list.'
            }), 400

        # Validate schedules if present
        if 'schedules' in data:
            if not isinstance(data['schedules'], list):
                print("UPLOAD: Invalid schedules format.")
                return jsonify({
                    'status': 'error',
                    'message': 'Schedules must be a list.'
                }), 400
            
            # Validate each schedule
            for schedule in data['schedules']:
                required_fields = ['start_day', 'start_time', 'end_day', 'end_time']
                if not all(field in schedule for field in required_fields):
                    print("UPLOAD: Invalid schedule structure.")
                    return jsonify({
                        'status': 'error',
                        'message': f'Each schedule must contain: {", ".join(required_fields)}'
                    }), 400

        # Return structured response with uncheck_logics flag
        response_data = {
            'status': 'success',
            'uncheck_logics': True,  # Add this flag
            'content': {
                'recordedTimes': data['recordedTimes']
            }
        }
        
        # Include schedules if present
        if 'schedules' in data:
            response_data['content']['schedules'] = data['schedules']
            
        print("UPLOAD: Processed file content successfully.")
        return jsonify(response_data)
        
    except json.JSONDecodeError:
        print("UPLOAD: Invalid JSON format.")
        return jsonify({
            'status': 'error',
            'message': 'File must contain valid JSON.'
        }), 400
    except Exception as e:
        print("UPLOAD: Error processing file:", str(e))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/set_schedule', methods=['POST'])
def set_schedule():
    data = request.get_json()
    # Handle new schedule format
    if 'schedules' in data and isinstance(data['schedules'], list):
        schedules = data.get('schedules', [])
        schedule_info = []
        for schedule in schedules:
            schedule_info.append(
                f"{schedule.get('start_day')} {schedule.get('start_time')} to "
                f"{schedule.get('end_day')} {schedule.get('end_time')}"
            )
        response_message = f"Multiple schedules set: {', '.join(schedule_info)}"
    else:
        # Handle legacy format for backward compatibility
        schedule_day = data.get('schedule_day')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        response_message = f"Schedule set for {schedule_day} from {start_time} to {end_time}."

    print("SET_SCHEDULE:", response_message)
    return jsonify({'status': 'success', 'message': response_message})


@app.route('/execute_logic1', methods=['POST'])
def execute_logic1_endpoint():
    data = request.get_json()
    recorded_times = data.get('recordedTimes', [])

    # Handle both new and old schedule formats
    if 'schedules' in data and isinstance(data['schedules'], list):
        schedule_data = data.get('schedules', [])
        print("EXECUTE_LOGIC1: Received multiple schedules:", schedule_data)
    else:
        schedule_data = data.get('schedule', {})
        print("EXECUTE_LOGIC1: Received single schedule:", schedule_data)

    print("EXECUTE_LOGIC1: Received recordedTimes:", recorded_times)

    try:
        result = execute_logic1(recorded_times, schedule_data)

        if isinstance(result, dict) and "error" in result:
            print("EXECUTE_LOGIC1: Error processing logic:", result["error"])
            return jsonify({'status': 'error', 'message': result["error"]}), 400

        # Ensure we have the expected format for the response
        if isinstance(result, dict) and "labeledRecords" in result:
            labeled_records = result["labeledRecords"]
        else:
            # In case the function returns the records directly
            labeled_records = result

        print("EXECUTE_LOGIC1: Successfully processed records. Labeled records:")
        print(labeled_records)
        return jsonify({'status': 'success', 'labeledRecords': labeled_records})

    except Exception as e:
        error_message = f"Error processing logic: {str(e)}"
        print("EXECUTE_LOGIC1:", error_message)
        return jsonify({'status': 'error', 'message': error_message}), 500


@app.route('/execute_logic2', methods=['POST'])
def execute_logic2_endpoint():
    data = request.get_json()
    recorded_times = data.get('recordedTimes', [])

    # Handle both new and old schedule formats
    if 'schedules' in data and isinstance(data['schedules'], list):
        schedule_data = data.get('schedules', [])
        print("EXECUTE_LOGIC2: Received multiple schedules:", schedule_data)
    else:
        schedule_data = data.get('schedule', {})
        print("EXECUTE_LOGIC2: Received single schedule:", schedule_data)

    print("EXECUTE_LOGIC2: Received recordedTimes:", recorded_times)

    try:
        result = execute_logic2(recorded_times, schedule_data)

        if isinstance(result, dict) and "error" in result:
            print("EXECUTE_LOGIC2: Error processing logic:", result["error"])
            return jsonify({'status': 'error', 'message': result["error"]}), 400

        # Ensure we have the expected format for the response
        if isinstance(result, dict) and "labeledRecords" in result:
            labeled_records = result["labeledRecords"]
        else:
            # In case the function returns the records directly
            labeled_records = result

        print("EXECUTE_LOGIC2: Successfully processed records. Labeled records:")
        print(labeled_records)
        return jsonify({'status': 'success', 'labeledRecords': labeled_records})

    except Exception as e:
        error_message = f"Error processing logic: {str(e)}"
        print("EXECUTE_LOGIC2:", error_message)
        return jsonify({'status': 'error', 'message': error_message}), 500


@app.route('/execute_logic3', methods=['POST'])
def execute_logic3_endpoint():
    try:
        data = request.get_json()
        recorded_times = data.get('recordedTimes', [])
        schedules = data.get('schedules', {})
        
        print("EXECUTE_LOGIC3: Received recordedTimes:", recorded_times)
        print("EXECUTE_LOGIC3: Received schedules:", schedules)
        
        result = execute_logic3(recorded_times, schedules)
        print("EXECUTE_LOGIC3: Successfully processed records.")
        
        return jsonify(result)
    except Exception as e:
        print("EXECUTE_LOGIC3: Error:", str(e))
        return jsonify({
            'status': 'error',
            'message': f"Error processing logic: {str(e)}"
        }), 500


if __name__ == '__main__':
    print("Starting Flask server on 0.0.0.0, port 5069...")
    app.run(debug=True, host='0.0.0.0', port=5069)