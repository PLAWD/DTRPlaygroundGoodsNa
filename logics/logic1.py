from datetime import datetime, timedelta


class TimeScheduleManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TimeScheduleManager, cls).__new__(cls)
        return cls._instance

    # ----------------------------------------
    # 1) Parse times
    # ----------------------------------------
    def parse_time_12_or_24(self, time_str):
        """
        Parse a schedule time like "6:00 AM" or "18:00" into a float in [0..24).
        """
        if not time_str or time_str.strip() == "":
            return 0.0  # Default to midnight if empty string

        fmts = ["%I:%M %p", "%H:%M"]
        for f in fmts:
            try:
                dt = datetime.strptime(time_str, f)
                return dt.hour + dt.minute / 60.0
            except ValueError:
                pass
        raise ValueError(f"Invalid schedule time: {time_str}")

    def parse_record_datetime(self, record_str):
        """
        Parse a record string in either format:
        - "DD/MM/YYYY - HH:MM AM/PM" (old format)
        - "Day - DD/MM/YYYY - HH:MM AM/PM" (new format)
        Returns a datetime object.
        """
        # Check which format we're dealing with
        parts = record_str.split(" - ")

        if len(parts) == 2:
            # Old format: "DD/MM/YYYY - HH:MM AM/PM"
            date_part = parts[0]
            time_part = parts[1]
            return datetime.strptime(f"{date_part} - {time_part}", "%d/%m/%Y - %I:%M %p")
        elif len(parts) == 3:
            # New format: "Day - DD/MM/YYYY - HH:MM AM/PM"
            # We can ignore the day part since it's redundant with the date
            date_part = parts[1]
            time_part = parts[2]
            return datetime.strptime(f"{date_part} - {time_part}", "%d/%m/%Y - %I:%M %p")
        else:
            raise ValueError(f"Invalid record format: {record_str}")

    def format_date_with_day(self, dt):
        """
        Format a datetime object as "Day - DD/MM/YYYY"
        """
        return f"{dt.strftime('%A')} - {dt.strftime('%d/%m/%Y')}"

    def get_day_index(self, day_name):
        """
        Convert day name to index (0 = Monday, 6 = Sunday)
        """
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        try:
            return days.index(day_name)
        except ValueError:
            # Default to Monday if invalid day name
            print(f"Invalid day name: {day_name}, defaulting to Monday")
            return 0  # Monday

    # ----------------------------------------
    # 2) Main processing logic
    # ----------------------------------------
    def process_recorded_times(self, recorded_times, schedule):
        """
        Process recorded times using the provided schedule.
        
        Input Formats:
        recorded_times: List from recordedTimes array containing strings like:
            "Day - DD/MM/YYYY - HH:MM AM/PM"
        
        schedule: Dictionary containing:
            {
                "start_day": "Day",    # Full weekday name
                "start_time": "HH:MM AM/PM",
                "end_day": "Day",      # Full weekday name
                "end_time": "HH:MM AM/PM"
            }
        """
        # Update input handling for new format
        if isinstance(recorded_times, dict):
            recorded_times = recorded_times.get("recordedTimes", [])
        
        if isinstance(schedule, dict) and "schedules" in schedule:
            schedule = schedule["schedules"][0] if schedule["schedules"] else None
        
        # Ensure we have valid schedule data with default values for missing fields
        if not schedule:
            schedule = {
                "start_day": "Monday",
                "start_time": "8:00 AM",
                "end_day": "Monday",
                "end_time": "5:00 PM"
            }

        # Use default values for any missing schedule components
        start_day = schedule.get("start_day", "Monday")
        start_time = schedule.get("start_time", "8:00 AM")
        end_day = schedule.get("end_day", start_day)  # Default to start_day if not provided
        end_time = schedule.get("end_time", "5:00 PM")

        # Ensure we have non-empty strings
        if not start_time or start_time.strip() == "":
            start_time = "8:00 AM"
        if not end_time or end_time.strip() == "":
            end_time = "5:00 PM"

        # 1) Parse schedule times
        start_h = self.parse_time_12_or_24(start_time)
        end_h = self.parse_time_12_or_24(end_time)

        # Get day indices (0 = Monday, 6 = Sunday)
        start_day_idx = self.get_day_index(start_day)
        end_day_idx = self.get_day_index(end_day)

        # Calculate day difference (accounts for week wraparound)
        day_diff = (end_day_idx - start_day_idx) % 7

        # Determine if shift spans multiple days
        is_multi_day = day_diff > 0 or (day_diff == 0 and end_h <= start_h)

        # For multi-day shifts, adjust the end time
        if is_multi_day:
            end_h += 24.0 * day_diff

        shift_duration = end_h - start_h

        # Define thresholds
        early_threshold = 3.0  # hours before start time
        grace_period = 0.25  # 15 minutes (in hours)
        late_threshold = 2.0  # hours after start time
        early_out_threshold = 1.0  # hour before end time

        # 2) Parse and sort records
        recs = []
        for orig in recorded_times:
            dt = self.parse_record_datetime(orig)

            # Extract day of week (as index 0-6)
            day_idx = dt.weekday()  # 0 = Monday, 6 = Sunday

            # Calculate normalized time for comparison with schedule
            # Base time is the hour and minute of the day as a float
            rec_time = dt.hour + dt.minute / 60.0

            # Extract original day from the record if it's in the new format
            orig_day = None
            if " - " in orig and len(orig.split(" - ")) == 3:
                orig_day = orig.split(" - ")[0]

            # Calculate day offset from start day
            day_offset = (day_idx - start_day_idx) % 7

            # Normalize time for comparison (add 24h for each day after start day)
            normalized_time = rec_time + 24.0 * day_offset

            # Check if this time is a valid start time
            start_diff = normalized_time - start_h
            is_valid_start = -early_threshold <= start_diff <= late_threshold

            # Check if this time is a valid end time
            end_diff = normalized_time - end_h
            is_valid_end = -early_out_threshold <= end_diff <= 0

            recs.append({
                "dt": dt,
                "orig": orig,
                "time_h": rec_time,
                "orig_day": orig_day,
                "day_idx": day_idx,
                "normalized_time": normalized_time,
                "is_valid_start": is_valid_start,
                "is_valid_end": is_valid_end
            })

        if not recs:
            return {"labeledRecords": []}

        # Sort records chronologically
        recs.sort(key=lambda x: x["dt"])

        # 3) Group records into logical shifts (including multi-day shifts)
        shifts = []
        current_shift = []

        # Add the first record to start the first shift
        if recs:
            current_shift.append(recs[0])

        # Process remaining records
        for i in range(1, len(recs)):
            prev_rec = recs[i - 1]
            curr_rec = recs[i]

            # Calculate time difference between consecutive records
            time_diff = (curr_rec["dt"] - prev_rec["dt"]).total_seconds() / 3600
            date_diff = (curr_rec["dt"].date() - prev_rec["dt"].date()).days

            # Check if this should be a new shift
            start_new_shift = False
            
            # If it's a different date AND the current record's time is close to the start time
            # OR if the previous record's time is close to the end time
            if date_diff > 0:
                curr_time = curr_rec["time_h"]
                prev_time = prev_rec["time_h"]
                
                # Check if current record is within 2 hours of shift start
                is_near_start = abs(curr_time - start_h) < 2.0
                
                # Check if previous record is within 2 hours of shift end
                is_prev_near_end = abs(prev_time - (end_h % 24)) < 2.0
                
                # Start a new shift if the current record is near the start time
                # or if the previous record is near the end time
                if is_near_start or is_prev_near_end:
                    start_new_shift = True
            
            # If it should be a new shift
            if start_new_shift:
                # Finalize current shift and start a new one
                if current_shift:
                    shifts.append(current_shift)
                current_shift = [curr_rec]
            else:
                # Add to current shift
                current_shift.append(curr_rec)

        # Add the last shift if it exists
        if current_shift:
            shifts.append(current_shift)

        # 4) Process each shift's records
        labeled_results = []

        for shift_recs in shifts:
            num_records = len(shift_recs)

            if num_records == 1:
                # Single record - classify based on time proximity
                rec = shift_recs[0]
                weekday = rec["orig_day"] if rec["orig_day"] else self.format_date_with_day(rec["dt"])

                if rec["is_valid_end"]:
                    label = "Time Out"
                else:
                    label = "Time In"

                labeled_results.append({
                    "record": rec["orig"],
                    "weekday": weekday,
                    "label": label
                })

            elif num_records == 2:
                # Two records - Time In and Time Out
                rec1, rec2 = shift_recs

                weekday1 = rec1["orig_day"] if rec1["orig_day"] else self.format_date_with_day(rec1["dt"])
                weekday2 = rec2["orig_day"] if rec2["orig_day"] else self.format_date_with_day(rec2["dt"])

                labeled_results.append({
                    "record": rec1["orig"],
                    "weekday": weekday1,
                    "label": "Time In"
                })

                labeled_results.append({
                    "record": rec2["orig"],
                    "weekday": weekday2,
                    "label": "Time Out"
                })

            else:
                # More than 2 records - first is Time In, last is Time Out,
                # intermediate records alternate between Break Out and Break In
                # (Break Out means leaving for break, Break In means returning from break)

                # Process first record (Time In)
                first_rec = shift_recs[0]
                first_weekday = first_rec["orig_day"] if first_rec["orig_day"] else self.format_date_with_day(
                    first_rec["dt"])

                labeled_results.append({
                    "record": first_rec["orig"],
                    "weekday": first_weekday,
                    "label": "Time In"
                })

                # Process intermediate records (Break Out, Break In, Break Out, ...)
                # CORRECTED: First intermediate is Break Out (leaving for break)
                for i in range(1, num_records - 1):
                    rec = shift_recs[i]
                    weekday = rec["orig_day"] if rec["orig_day"] else self.format_date_with_day(rec["dt"])

                    # FIXED: Odd indices are Break Out, even indices are Break In
                    # First intermediate (i=1) should be Break Out (leaving work for break)
                    label = "Break Out" if i % 2 == 1 else "Break In"

                    labeled_results.append({
                        "record": rec["orig"],
                        "weekday": weekday,
                        "label": label
                    })

                # Process last record (Time Out)
                last_rec = shift_recs[num_records - 1]
                last_weekday = last_rec["orig_day"] if last_rec["orig_day"] else self.format_date_with_day(
                    last_rec["dt"])

                labeled_results.append({
                    "record": last_rec["orig"],
                    "weekday": last_weekday,
                    "label": "Time Out"
                })

        # Sort results by original timestamp order
        labeled_results.sort(key=lambda x: self.parse_record_datetime(x["record"]))

        return {"labeledRecords": labeled_results}

    def find_applicable_schedule(self, dt, schedules):
        """
        Find the applicable schedule for a given datetime from a list of schedules.
        Returns the matching schedule or None if no match is found.

        Each schedule in schedules should be in the format:
        {
            "start_day": "Monday",
            "start_time": "12:00 PM",
            "end_day": "Monday",
            "end_time": "6:00 PM"
        }
        """
        if not schedules:
            return None

        # Get the day of week for the datetime (0 = Monday, 6 = Sunday)
        dt_day_idx = dt.weekday()
        dt_time = dt.hour + dt.minute / 60.0

        for schedule in schedules:
            # Get indices for schedule days
            start_day_idx = self.get_day_index(schedule.get("start_day", "Monday"))
            end_day_idx = self.get_day_index(schedule.get("end_day", schedule.get("start_day", "Monday")))

            # Parse schedule times
            start_time = schedule.get("start_time", "8:00 AM")
            end_time = schedule.get("end_time", "5:00 PM")

            # Ensure we have non-empty strings
            if not start_time or start_time.strip() == "":
                start_time = "8:00 AM"
            if not end_time or end_time.strip() == "":
                end_time = "5:00 PM"

            start_h = self.parse_time_12_or_24(start_time)
            end_h = self.parse_time_12_or_24(end_time)

            # Calculate day difference (accounts for week wraparound)
            day_diff = (end_day_idx - start_day_idx) % 7

            # Handle multi-day shifts
            is_multi_day = day_diff > 0 or (day_diff == 0 and end_h <= start_h)

            # Case 1: Same day schedule
            if not is_multi_day and dt_day_idx == start_day_idx:
                if start_h <= dt_time <= end_h:
                    return schedule

            # Case 2: Multi-day schedule
            else:
                # Check if dt is on start day after start time
                if dt_day_idx == start_day_idx and dt_time >= start_h:
                    return schedule

                # Check if dt is on end day before end time
                if dt_day_idx == end_day_idx and dt_time <= end_h:
                    return schedule

                # Check if dt is on a day between start and end day
                if day_diff > 1:
                    days_between = [(start_day_idx + d) % 7 for d in range(1, day_diff)]
                    if dt_day_idx in days_between:
                        return schedule

        # No matching schedule found
        return None

    def process_recorded_times_with_schedules(self, recorded_times, schedules):
        """
        Process recorded times using multiple schedules.
        Groups records by applicable schedule and processes each group.
        """
        if not recorded_times:
            return {"labeledRecords": []}

        # Ensure we have valid schedules with default values
        if not schedules or not isinstance(schedules, list) or len(schedules) == 0:
            # Default schedule if none provided
            schedules = [{
                "start_day": "Monday",
                "start_time": "8:00 AM",
                "end_day": "Monday",
                "end_time": "5:00 PM"
            }]

        # Parse all record datetimes
        parsed_records = [(rec, self.parse_record_datetime(rec)) for rec in recorded_times]

        # Group records by applicable schedule
        schedule_groups = {}

        for rec, dt in parsed_records:
            applicable_schedule = self.find_applicable_schedule(dt, schedules)

            if applicable_schedule:
                # Create a key from the schedule to group records
                schedule_key = (
                    f"{applicable_schedule.get('start_day', 'Monday')}_"
                    f"{applicable_schedule.get('start_time', '8:00 AM')}_"
                    f"{applicable_schedule.get('end_day', applicable_schedule.get('start_day', 'Monday'))}_"
                    f"{applicable_schedule.get('end_time', '5:00 PM')}"
                )

                if schedule_key not in schedule_groups:
                    schedule_groups[schedule_key] = {
                        "schedule": applicable_schedule,
                        "records": []
                    }

                schedule_groups[schedule_key]["records"].append(rec)
            else:
                # Handle records with no matching schedule
                # Use the schedule for the day of the week this record falls on
                record_day = dt.strftime('%A')
                matching_schedule = None

                for schedule in schedules:
                    if schedule.get("start_day") == record_day:
                        matching_schedule = schedule
                        break

                if not matching_schedule and schedules:
                    matching_schedule = schedules[0]  # Default to first schedule

                if matching_schedule:
                    schedule_key = (
                        f"{matching_schedule.get('start_day', 'Monday')}_"
                        f"{matching_schedule.get('start_time', '8:00 AM')}_"
                        f"{matching_schedule.get('end_day', matching_schedule.get('start_day', 'Monday'))}_"
                        f"{matching_schedule.get('end_time', '5:00 PM')}"
                    )

                    if schedule_key not in schedule_groups:
                        schedule_groups[schedule_key] = {
                            "schedule": matching_schedule,
                            "records": []
                        }

                    schedule_groups[schedule_key]["records"].append(rec)

        # Process each group with its applicable schedule
        all_labeled_records = []

        for group_data in schedule_groups.values():
            result = self.process_recorded_times(group_data["records"], group_data["schedule"])
            all_labeled_records.extend(result["labeledRecords"])

        # Sort all results by timestamp
        all_labeled_records.sort(key=lambda x: self.parse_record_datetime(x["record"]))

        return {"labeledRecords": all_labeled_records}


# For convenience, expose the process functions
def execute_logic1(recorded_times, schedule_or_schedules):
    """
    Wrapper function that maintains compatibility with the original logic1 checkbox.
    This function can handle both a single schedule or a list of schedules.
    """
    manager = TimeScheduleManager()

    # Check if we have a list of schedules or a single schedule
    if isinstance(schedule_or_schedules, list):
        # If we have a list of schedules, use the multi-schedule function
        return manager.process_recorded_times_with_schedules(recorded_times, schedule_or_schedules)
    else:
        # If we have a single schedule, use the original function
        return manager.process_recorded_times(recorded_times, schedule_or_schedules)


# Still provide direct access to the individual functions if needed
process_with_single_schedule = TimeScheduleManager().process_recorded_times
process_with_schedules = TimeScheduleManager().process_recorded_times_with_schedules