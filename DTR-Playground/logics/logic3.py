from datetime import datetime, timedelta
from .logic1 import TimeScheduleManager

class TimeScheduleReviewer:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TimeScheduleReviewer, cls).__new__(cls)
            # Create an instance of TimeScheduleManager from logic1
            cls._instance.logic1_manager = TimeScheduleManager()
        return cls._instance

    def parse_time_12_or_24(self, time_str):
        """Parse a schedule time like "6:00 AM" or "18:00" into a float in [0..24)."""
        # Reuse Logic1's parsing
        return self.logic1_manager.parse_time_12_or_24(time_str)

    def parse_record_datetime(self, record_str):
        """Parse a record string and return datetime object."""
        # First, remove any label that might be in parentheses at the end
        clean_record = record_str
        if " (" in record_str and record_str.endswith(")"):
            clean_record = record_str[:record_str.rfind(" (")]
        
        try:
            # Try to use Logic1's parsing
            return self.logic1_manager.parse_record_datetime(clean_record)
        except ValueError:
            # More robust fallback parsing
            parts = clean_record.split(" - ")
            
            # Extract date part
            date_match = None
            for part in parts:
                if part.count("/") == 2:  # Likely a date in DD/MM/YYYY format
                    date_match = part.strip()
                    break
            
            if not date_match:
                raise ValueError(f"Could not find date in: {record_str}")
            
            # Extract time part - get the last part and remove any label that might be there
            time_part = parts[-1].strip()
            if " (" in time_part:
                time_part = time_part[:time_part.find(" (")].strip()
            
            # Extract just the HH:MM AM/PM portion
            time_parts = time_part.split()
            if len(time_parts) >= 2:
                time_str = f"{time_parts[0]} {time_parts[1]}"
                
                # Try to parse the time to validate it
                try:
                    # Just test if this is valid - don't use the result
                    datetime.strptime(time_str, "%I:%M %p")
                    time_match = time_str
                except ValueError:
                    # If that failed, time might be in other format or have extra text
                    raise ValueError(f"Invalid time format in: {time_part}")
            else:
                raise ValueError(f"Could not extract time from: {time_part}")
            
            if not time_match:
                raise ValueError(f"Could not find time in: {record_str}")
            
            # Now parse with just the clean date and time
            try:
                return datetime.strptime(f"{date_match} - {time_match}", "%d/%m/%Y - %I:%M %p")
            except ValueError as e:
                # Provide more detailed error message for debugging
                error_msg = f"Error parsing '{date_match} - {time_match}' from '{record_str}': {str(e)}"
                print(error_msg)  # Log the error
                raise ValueError(error_msg)

    def check_schedule_validity(self, records, schedule):
        """Check if records follow valid schedule patterns."""
        try:
            start_h = self.parse_time_12_or_24(schedule["start_time"])
            end_h = self.parse_time_12_or_24(schedule["end_time"])
            
            # Handle overnight shifts
            is_overnight = False
            if schedule["start_day"] != schedule["end_day"]:
                is_overnight = True
            elif end_h <= start_h:
                is_overnight = True
            
            if is_overnight:
                end_h += 24.0

            issues = []
            
            # Group records by date to handle overnight shifts properly
            date_groups = {}
            for rec in records:
                dt = self.parse_record_datetime(rec["record"])
                
                # Check for day/date mismatch
                parts = rec["record"].split(" - ")
                if len(parts) == 3:
                    record_day = parts[0].strip()
                    date_str = parts[1].strip()
                    
                    # Get the actual day of week from the date
                    try:
                        actual_date = datetime.strptime(date_str, "%d/%m/%Y")
                        actual_day = actual_date.strftime("%A")
                        
                        # If there's a mismatch, log it as an issue
                        if record_day != actual_day:
                            issues.append(f"Day/date mismatch in record: {rec['record']} (date is actually a {actual_day})")
                            # Skip further validation for this record since it has inconsistent data
                            continue
                    except ValueError:
                        # If date can't be parsed, just continue with validation
                        pass
                
                date_str = dt.strftime("%Y-%m-%d")
                if date_str not in date_groups:
                    date_groups[date_str] = []
                date_groups[date_str].append((rec, dt))

            # Validate each day's records
            for date_records in date_groups.values():
                date_records.sort(key=lambda x: x[1])  # Sort by datetime
                
                for rec, dt in date_records:
                    # Skip records with day/date mismatch
                    if any(issue.startswith("Day/date mismatch") and rec["record"] in issue for issue in issues):
                        continue
                        
                    record_day = dt.strftime("%A")
                    
                    # Skip records that don't match this schedule's days
                    if record_day != schedule["start_day"] and record_day != schedule["end_day"]:
                        continue
                    
                    time_h = dt.hour + dt.minute / 60.0
                    label = rec["label"]
                    
                    # Skip checking Time In (Late) records and validated overtime
                    if label == "Time In (Late)" or (rec.get("validated_overtime", False) and (label.startswith("Time Out") or label.endswith("(Overtime)"))):
                        continue
                        
                    # Adjust time for overnight comparison
                    if is_overnight and record_day == schedule["end_day"]:
                        time_h += 24.0

                    # Only check for significant violations
                    if label.startswith("Time In") and label != "Time In (Late)":
                        if time_h < start_h - 1.0 and record_day == schedule["start_day"]:  # More than 1 hour early
                            issues.append(f"Early arrival: {rec['record']}")
                        elif time_h > start_h + 1.0 and record_day == schedule["start_day"]:  # More than 1 hour late
                            issues.append(f"Late arrival: {rec['record']}")
                    
                    elif label.startswith("Time Out"):
                        if time_h < end_h - 1.0 and record_day == schedule["end_day"]:  # More than 1 hour early
                            issues.append(f"Early departure: {rec['record']}")
                        elif time_h > end_h + 0.5 and record_day == schedule["end_day"]:  # More than 30 minutes overtime
                            # Only add overtime issue if NOT validated
                            if not rec.get("validated_overtime", False):
                                issues.append(f"Overtime: {rec['record']}")

            return issues

        except (KeyError, ValueError) as e:
            print(f"Error validating schedule: {str(e)}")
            return []

    def process_shift_records(self, records):
        """
        Process records within a shift:
        - The first record is always taken as Time In (with early/late adjustments)
        - The last record is always taken as Time Out (or Time Out (Overtime) if flagged)
        - All records between are alternately labeled as Break Out and Break In
        """
        num_records = len(records)
        labeled_records = []

        if num_records == 0:
            return labeled_records

        # First record as Time In
        first_rec = records[0]
        time_in_label = "Time In"
        if first_rec.get("is_early", False):
            time_in_label = "Time In (Early)"
        elif first_rec.get("is_late", False):
            time_in_label = "Time In (Late)"
        labeled_records.append({
            "record": first_rec["record"],
            "datetime": first_rec["datetime"],
            "label": time_in_label,
            "validated_overtime": first_rec.get("validated_overtime", False)
        })

        # Intermediate records (if any) alternate between Break Out and Break In
        if num_records > 2:
            state = "Break Out"  # start with Break Out
            for rec in records[1:-1]:
                labeled_records.append({
                    "record": rec["record"],
                    "datetime": rec["datetime"],
                    "label": state,
                    "validated_overtime": rec.get("validated_overtime", False)
                })
                state = "Break In" if state == "Break Out" else "Break Out"

        # Last record as Time Out (if there is at least one more record)
        if num_records >= 2:
            last_rec = records[-1]
            time_out_label = "Time Out (Overtime)" if last_rec.get("is_overtime", False) else "Time Out"
            labeled_records.append({
                "record": last_rec["record"],
                "datetime": last_rec["datetime"],
                "label": time_out_label,
                "validated_overtime": last_rec.get("validated_overtime", False)
            })

        return labeled_records

    def merge_schedule(self, records, needs_review=False):
        """Merge all schedule records into a single row."""
        if not records:
            return []

        # Group records by date
        date_groups = {}
        for rec in records:
            # Handle both old and new format
            parts = rec["record"].split(" - ")
            if len(parts) == 3:
                day, date_str, _ = parts
            else:
                date_str = parts[0]
                # Calculate day from date
                dt = datetime.strptime(date_str, "%d/%m/%Y")
                day = dt.strftime("%A")
            
            if date_str not in date_groups:
                date_groups[date_str] = {"day": day, "records": []}
            date_groups[date_str]["records"].append(rec)

        # Create merged records for each date
        merged_records = []
        prev_date = None
        prev_day_records_count = 0
        
        # Sort date_groups by date for consistent processing
        sorted_dates = sorted(date_groups.keys(), key=lambda x: datetime.strptime(x, "%d/%m/%Y"))
        
        for date_str in sorted_dates:
            group_data = date_groups[date_str]
            # Sort records by time
            group_data["records"].sort(key=lambda x: x["datetime"])
            
            # Collect times for this date
            times = []
            
            for rec in group_data["records"]:
                time_part = rec["record"].split(" - ")[-1]
                # Remove any label that might already be in the time part
                if " (" in time_part:
                    time_part = time_part[:time_part.find(" (")]
                
                # Use the original label for display in the review modal
                display_label = rec["label"]
                
                # Append the time and label to the times list
                times.append(f"{time_part} ({display_label})")
            
            merged_records.append({
                "date": date_str,
                "day": group_data["day"],
                "times": " | ".join(times),
                "records": group_data["records"]
            })
            
            # Update tracking variables for next iteration
            prev_date = datetime.strptime(date_str, "%d/%m/%Y").date()
            prev_day_records_count = len(group_data["records"])

        return merged_records

    def process_records(self, recorded_times, schedule_data, output_file=None):
        """Process records with schedule compatibility, handling all record patterns"""
        if not recorded_times:
            return {"status": "error", "message": "No records provided"}

        # Extract schedules from the nested structure
        schedules = None
        if isinstance(schedule_data, dict):
            schedules = schedule_data.get("schedules", [])
        elif isinstance(schedule_data, list):
            schedules = schedule_data
        
        if not schedules:
            return {"status": "error", "message": "No schedules provided"}

        # Parse all records with datetime objects
        parsed_records = []
        # Keep track of validated overtime records by their string representation
        validated_overtime_records = {}
        labeled_records_map = {}
        
        for record in recorded_times:
            # Check if this is a dictionary with validation info
            validated_overtime = False
            label_info = None
            record_str = record
            
            if isinstance(record, dict):
                validated_overtime = record.get("validated_overtime", False)
                label_info = record.get("label", None)
                record_str = record.get("record", record)
                
                # Store validated records in our lookup map
                if validated_overtime:
                    validated_overtime_records[record_str] = True
                
                # Store label info for lookup
                if label_info:
                    labeled_records_map[record_str] = label_info
            
            dt = self.parse_record_datetime(record_str)
            parsed_records.append({
                "record": record_str,
                "datetime": dt,
                "is_overtime": False,
                "is_early": False,
                "is_late": False,
                "validated_overtime": validated_overtime,
                "original_label": label_info,
                "matched_schedule": None  # Track which schedule this record matches
            })
        
        # Sort chronologically first
        parsed_records.sort(key=lambda x: x["datetime"])
        
        # IMPROVED APPROACH: Tag each record with its matching schedule and exact time flags
        for record in parsed_records:
            record_day = record["datetime"].strftime("%A")
            record_hour = record["datetime"].hour
            record_minute = record["datetime"].minute
            record_time = record_hour + record_minute / 60.0
            
            # Initialize flags
            record["exact_time_in"] = False
            record["exact_time_out"] = False
            record["is_overtime_candidate"] = False  # New flag for overtime detection
            
            # Find the best matching schedule for this record
            best_schedule = None
            best_match_score = 0
            
            for schedule in schedules:
                match_score = 0
                
                # Check if this is an overnight/multi-day schedule
                is_overnight = False
                days_span = 0
                if schedule.get("start_day") != schedule.get("end_day"):
                    # Calculate the number of days between start and end
                    start_day_idx = self.logic1_manager.get_day_index(schedule.get("start_day"))
                    end_day_idx = self.logic1_manager.get_day_index(schedule.get("end_day"))
                    days_span = (end_day_idx - start_day_idx) % 7
                    is_overnight = True
                elif schedule.get("end_time") and schedule.get("start_time"):
                    # Check if end time is earlier than start time on same day (overnight)
                    start_h = self.parse_time_12_or_24(schedule.get("start_time"))
                    end_h = self.parse_time_12_or_24(schedule.get("end_time"))
                    if end_h <= start_h:
                        is_overnight = True
                        days_span = 1
                
                # Store overnight info in the schedule for future reference
                schedule["_is_overnight"] = is_overnight
                schedule["_days_span"] = days_span
                
                # Check if day matches schedule days
                if record_day == schedule.get("start_day"):
                    match_score += 1
                    
                    # Check proximity to start time
                    start_time = self.parse_time_12_or_24(schedule.get("start_time"))
                    time_diff = abs(record_time - start_time)
                    
                    if time_diff <= 0.08:  # Within 5 minutes
                        match_score += 3
                        record["exact_time_in"] = True
                    elif time_diff <= 0.5:  # Within 30 minutes
                        match_score += 2
                    elif time_diff <= 2.0:  # Within 2 hours
                        match_score += 1
                
                if record_day == schedule.get("end_day"):
                    match_score += 1
                    
                    # Check proximity to end time
                    end_time = self.parse_time_12_or_24(schedule.get("end_time"))
                    time_diff = abs(record_time - end_time)
                    
                    if time_diff <= 0.08:  # Within 5 minutes
                        match_score += 3
                        record["exact_time_out"] = True
                    elif time_diff <= 0.5:  # Within 30 minutes
                        match_score += 2
                    elif time_diff <= 2.0:  # Within 2 hours
                        match_score += 1
                    
                    # Check if this is a potential overtime record
                    if record_time > end_time + 0.25:  # More than 15 minutes past end time
                        record["is_overtime_candidate"] = True
                
                # For overnight/multi-day schedules, check if this record falls between start and end
                if schedule.get("start_day") != schedule.get("end_day"):
                    start_day_idx = self.logic1_manager.get_day_index(schedule.get("start_day"))
                    end_day_idx = self.logic1_manager.get_day_index(schedule.get("end_day"))
                    record_day_idx = self.logic1_manager.get_day_index(record_day)
                    
                    # Check if record falls on a day between start and end days
                    days_between = []
                    if end_day_idx > start_day_idx:
                        days_between = list(range(start_day_idx + 1, end_day_idx))
                    else:  # Wrap around the week
                        days_between = list(range(start_day_idx + 1, 7)) + list(range(0, end_day_idx))
                    
                    if record_day_idx in days_between:
                        match_score += 2  # Strong indicator for multi-day shifts
                
                # After calculating the match score, require a minimum time proximity
                # This prevents matching records that are too far from any schedule time
                if match_score > 0:
                    # Calculate minimum time difference to either start or end time
                    start_time = self.parse_time_12_or_24(schedule.get("start_time"))
                    end_time = self.parse_time_12_or_24(schedule.get("end_time"))
                    
                    # Handle overnight schedules
                    is_overnight = False
                    if schedule["start_day"] != schedule["end_day"]:
                        is_overnight = True
                    elif end_time <= start_time:
                        is_overnight = True
                        
                    # Adjust end time for overnight comparison
                    if is_overnight and record_day == schedule["end_day"]:
                        adjusted_end_time = end_time + 24.0
                    else:
                        adjusted_end_time = end_time
                    
                    min_time_diff = min(abs(record_time - start_time), abs(record_time - adjusted_end_time))
                    
                    # If time difference is too large, significantly reduce the match score
                    if min_time_diff > 3.0:  # More than 3 hours away from any schedule time
                        match_score = match_score * 0.5  # Reduce but don't eliminate the score
                
                # If this is the best match so far, update
                if match_score > best_match_score:
                    best_match_score = match_score
                    best_schedule = schedule
            
            # Assign the best matching schedule
            if best_match_score > 0:
                record["matched_schedule"] = best_schedule
        
        # Now group records into shifts based on schedule matches and time proximity
        shifts = []
        current_shift = []
        current_shift_date = None  # Track the date of the current shift
        current_shift_schedule = None  # Track the schedule of the current shift
        
        # Sort schedules by duration (longest first) to prioritize them
        sorted_schedules = sorted(schedules, 
                                  key=lambda s: (s.get("_days_span", 0) if s.get("_is_overnight") else 0),
                                  reverse=True)
        
        # First, pre-group records by their most likely full shifts based on schedules
        shift_groups = []
        
        # Look for full shift patterns first (find records that match start and end times of schedules)
        for schedule in sorted_schedules:
            if not schedule.get("_is_overnight", False):
                continue  # Skip non-overnight schedules for this initial pass
                
            start_day = schedule.get("start_day")
            end_day = schedule.get("end_day")
            start_time = self.parse_time_12_or_24(schedule.get("start_time"))
            end_time = self.parse_time_12_or_24(schedule.get("end_time"))
            days_span = schedule.get("_days_span", 1)
            
            # Find records that could be start points (close to start time on start day)
            potential_starts = []
            for i, record in enumerate(parsed_records):
                if not record.get("already_grouped", False):  # Skip records already in a group
                    record_day = record["datetime"].strftime("%A")
                    record_time = record["datetime"].hour + record["datetime"].minute / 60.0
                    
                    if record_day == start_day and abs(record_time - start_time) <= 1.0:
                        potential_starts.append((i, record))
            
            # For each potential start, look for a matching end
            for start_idx, start_record in potential_starts:
                start_date = start_record["datetime"].date()
                
                # Calculate expected end date based on days_span
                expected_end_date = start_date + timedelta(days=days_span)
                
                # Find a potential matching end record
                found_end = False
                potential_end_record = None
                potential_end_idx = None
                
                for j, record in enumerate(parsed_records):
                    if j <= start_idx or record.get("already_grouped", False):
                        continue  # Skip records before start or already grouped
                        
                    record_day = record["datetime"].strftime("%A")
                    record_date = record["datetime"].date()
                    record_time = record["datetime"].hour + record["datetime"].minute / 60.0
                    
                    # Check if this record matches expected end criteria
                    if (record_day == end_day and 
                        record_date == expected_end_date and 
                        abs(record_time - end_time) <= 1.0):
                        found_end = True
                        potential_end_record = record
                        potential_end_idx = j
                        break
                
                if found_end:
                    # We found a matching start and end record for this schedule
                    # Group all records between them (inclusive)
                    group = []
                    for k in range(start_idx, potential_end_idx + 1):
                        record = parsed_records[k]
                        if not record.get("already_grouped", False):  # Extra safety check
                            record["already_grouped"] = True
                            record["matched_schedule"] = schedule  # Ensure correct schedule
                            group.append(record)
                    
                    if group:
                        shift_groups.append((group, schedule))
        
        # Now process any remaining records to prioritize same-day clustering
        for record in parsed_records:
            if record.get("already_grouped", False):
                continue  # Skip records we've already grouped
                
            # Get record date as a string for easier comparison
            record_date_str = record["datetime"].strftime("%Y-%m-%d")
            record_day = record["datetime"].strftime("%A")
            
            # Get record's matched schedule
            matched_schedule = record.get("matched_schedule")
            
            # Determine if we're dealing with a same-day schedule
            is_same_day_schedule = matched_schedule and (
                matched_schedule.get("start_day") == matched_schedule.get("end_day")
            )
            
            # START NEW SHIFT IF:
            start_new_shift = False
            
            # Case 1: This is the first record
            if not current_shift:
                start_new_shift = False  # Not really starting a new shift, just adding the first record
                current_shift_schedule = matched_schedule
                current_shift_date = record_date_str
            
            # Case 2: Day changed
            elif record_date_str != current_shift_date:
                # Check if this could be part of an ongoing overnight shift
                if current_shift_schedule and current_shift_schedule.get("_is_overnight"):
                    prev_record = current_shift[-1]
                    prev_day = prev_record["datetime"].strftime("%A")
                    prev_date = prev_record["datetime"].date()
                    curr_date = record["datetime"].date()
                    
                    # Check if the days are in the correct sequence for this schedule
                    if (prev_day == current_shift_schedule.get("start_day") and 
                        record_day == current_shift_schedule.get("end_day") and
                        (curr_date - prev_date).days <= current_shift_schedule.get("_days_span", 1)):
                        # This is a valid overnight continuation
                        start_new_shift = False
                    else:
                        start_new_shift = True
                else:
                    start_new_shift = True
                    
            # Case 3: Schedule changed significantly
            elif matched_schedule != current_shift_schedule:
                # Only start a new shift if both records have strong schedule matches
                if matched_schedule and current_shift_schedule:
                    # SPECIAL HANDLING for same-day schedules:
                    current_is_same_day = current_shift_schedule.get("start_day") == current_shift_schedule.get("end_day")
                    new_is_same_day = matched_schedule.get("start_day") == matched_schedule.get("end_day")
                    
                    # If both are same-day schedules but different schedules, start a new shift
                    if current_is_same_day and new_is_same_day and matched_schedule != current_shift_schedule:
                        start_new_shift = True
                    # If changing from overnight to same-day or vice versa, start a new shift
                    elif current_is_same_day != new_is_same_day:
                        start_new_shift = True
            
            # Case 4: Large time gap - ONLY FOR NON-SAME-DAY SCHEDULES
            elif current_shift and not is_same_day_schedule:
                prev_record = current_shift[-1]
                time_diff_hours = (record["datetime"] - prev_record["datetime"]).total_seconds() / 3600
                
                # Different thresholds based on schedule type
                if current_shift_schedule and current_shift_schedule.get("_is_overnight"):
                    # Overnight shifts can have longer gaps
                    time_threshold = 12.0
                else:
                    # Regular shifts use a smaller threshold
                    time_threshold = 4.0
                    
                if time_diff_hours > time_threshold:
                    start_new_shift = True
            
            # SPECIAL CASE: For same-day schedules, group all records from the same day together
            # (regardless of time gaps, exact match status, etc.)
            if is_same_day_schedule and current_shift and record_date_str == current_shift_date:
                # Same-day schedule and same date as current shift, always continue current shift
                start_new_shift = False
            
            # Handle the shift assignment
            if start_new_shift:
                if current_shift:
                    shifts.append(current_shift)
                current_shift = [record]
                current_shift_date = record_date_str
                current_shift_schedule = matched_schedule
            else:
                # Add to current shift
                current_shift.append(record)
                if not current_shift_date:
                    current_shift_date = record_date_str
        
        # Add the final regular shift if not empty
        if current_shift:
            shifts.append(current_shift)
        
        # Now add all the pre-identified complete shifts
        for group, schedule in shift_groups:
            shifts.append(group)
        
        # Sort all shifts by their first record's timestamp
        shifts.sort(key=lambda shift: shift[0]["datetime"])
        
        # Debug: Print out the shift grouping
        print("\n===== SHIFT GROUPING (Schedule Reference) =====")
        for shift_idx, shift in enumerate(shifts):
            print(f"\nSHIFT #{shift_idx + 1}:")
            print("-" * 50)
            for rec_idx, rec in enumerate(shift):
                rec_day = rec["datetime"].strftime("%A")
                rec_date = rec["datetime"].strftime("%d/%m/%Y")
                rec_time = rec["datetime"].strftime("%I:%M %p")
                sched_info = ""
                if rec["matched_schedule"]:
                    sched_info = f" (Matched: {rec['matched_schedule'].get('start_day')} {rec['matched_schedule'].get('start_time')})"
                print(f"{rec_idx + 1}. {rec_day} - {rec_date} - {rec_time}{sched_info}")
            print("-" * 50)
        print("===== END SHIFT GROUPING =====\n")
        
        # Process each shift by applying schedules
        all_records = []
        all_issues = []

        for shift in shifts:
            # Find matching schedule for this shift
            first_record = shift[0]
            first_day = first_record["datetime"].strftime("%A")
            matching_schedule = None
            
            # Try to find the matching schedule from the first record
            if first_record.get("matched_schedule"):
                matching_schedule = first_record.get("matched_schedule")
            else:
                # If no schedule is matched yet, try to find one based on the day
                for schedule in schedules:
                    if schedule.get("start_day") == first_day:
                        matching_schedule = schedule
                        break
            
            # Early/late detection for the first record
            if matching_schedule:
                # Get schedule start time
                start_time = self.parse_time_12_or_24(matching_schedule.get("start_time"))
                # Get first record time
                first_time = first_record["datetime"].hour + first_record["datetime"].minute / 60.0
                
                # Check if early/late
                if first_time < start_time - 0.25:  # More than 15 minutes early
                    first_record["is_early"] = True
                elif first_time > start_time + 0.25:  # More than 15 minutes late
                    first_record["is_late"] = True
                
                # Overtime detection for last record
                if len(shift) >= 2:
                    last_record = shift[-1]
                    last_day = last_record["datetime"].strftime("%A")
                    last_time = last_record["datetime"].hour + last_record["datetime"].minute / 60.0
                    
                    # Only check overtime if this is the end day of the schedule
                    if last_day == matching_schedule.get("end_day"):
                        end_time = self.parse_time_12_or_24(matching_schedule.get("end_time"))
                        
                        # If end time is less than start time, it's an overnight shift
                        if end_time < start_time and matching_schedule.get("start_day") == matching_schedule.get("end_day"):
                            end_time += 24.0
                        
                        # If the last record is more than 15 minutes past end time, mark as overtime
                        if last_time > end_time + 0.25 or last_record.get("is_overtime_candidate", False):
                            last_record["is_overtime"] = True
            
            # Process this shift to generate labeled records
            processed_records = self.process_shift_records(shift)
            
            # Ensure validated_overtime flag is preserved in the processed records
            for rec in processed_records:
                # Check if this record was previously validated
                if rec["record"] in validated_overtime_records:
                    rec["validated_overtime"] = True
                
                # Add any previous label info if we need to preserve it
                if rec["record"] in labeled_records_map:
                    rec["original_label"] = labeled_records_map[rec["record"]]
            
            # Check validity against schedule if a matching schedule was found
            if matching_schedule:
                issues = self.check_schedule_validity(processed_records, matching_schedule)
                all_issues.extend(issues)
            
            all_records.extend(processed_records)

        # Sort all records chronologically (important for display)
        all_records.sort(key=lambda x: x["datetime"])

        # Print issues to console
        if all_issues:
            print("\n===== ISSUES FOUND =====")
            for i, issue in enumerate(all_issues, 1):
                print(f"{i}. {issue}")
            print("=======================\n")
        else:
            print("No issues found in schedule records.")

        return {
            "status": "success",
            "merged_records": self.merge_schedule(all_records, len(all_issues) > 0),
            "needs_review": len(all_issues) > 0,
            "issues": all_issues,
            "original_records": all_records,
            "schedules": [
                {
                    "recordedTimes": [
                        "Day - DD/MM/YYYY - HH:MM AM/PM"
                    ]
                }
            ]
        }

    def save_changes_to_json(self, records, filename):
        """
        Save the current records to a JSON file in the simple format:
        { "recordedTimes": ["Day - DD/MM/YYYY - HH:MM AM/PM"] }
        
        This removes labels from the output JSON and just includes the timestamps.
        """
        import json
        
        # Extract just the clean timestamp strings without labels
        recorded_times = []
        for rec in records:
            # Get the original record string
            record_str = rec["record"]
            
            # Remove any label if present
            clean_record = record_str
            if " (" in record_str and record_str.endswith(")"):
                clean_record = record_str[:record_str.rfind(" (")]
            
            recorded_times.append(clean_record)
        
        # Create the output structure
        output_data = {
            "recordedTimes": recorded_times
        }
        
        # Write to file
        with open(filename, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        return filename

    def on_save_changes_button_clicked(self):
        """Handler for the save changes button."""
        # Get the current records from your UI
        current_records = self.get_current_records_from_ui()
        
        # Ask user for save location
        filename = self.get_save_filename_from_user()
        
        if filename:
            # Save to the selected file
            saved_file = self.reviewer.save_changes_to_json(current_records, filename)
            self.show_success_message(f"Changes saved to {saved_file}")


# Expose the process function
execute_logic3 = TimeScheduleReviewer().process_records