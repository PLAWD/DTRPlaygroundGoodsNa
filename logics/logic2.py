from datetime import datetime, timedelta
import copy


class OvertimeScheduleManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OvertimeScheduleManager, cls).__new__(cls)
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

    def get_date_string(self, dt):
        """Extract just the date part of a datetime as a string"""
        return dt.strftime("%Y-%m-%d")

    # ----------------------------------------
    # 2) Main processing logic with overtime detection
    # ----------------------------------------
    def process_recorded_times(self, recorded_times, schedule):
        """
        Process recorded times using the provided schedule.
        Logic 2 extends the core functionality from Logic 1 with:
        1. Overtime detection - marks records as overtime when they exceed scheduled hours
        2. Enhanced break detection with scheduled break handling

        Schedule format: {
            "start_day": "Monday",
            "start_time": "12:00 PM",
            "end_day": "Monday",  # Or "Tuesday" for overnight
            "end_time": "6:00 PM"
        }
        """
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

        # Determine if shift spans multiple days (including overnight)
        is_overnight = (day_diff == 0 and end_h <= start_h) or day_diff > 0

        # For multi-day shifts, adjust the end time
        if is_overnight:
            end_h += 24.0 * (1 if day_diff == 0 else day_diff)

        # Calculate standard shift duration
        shift_duration = end_h - start_h

        # Set overtime threshold (typically end of shift)
        overtime_threshold_h = end_h

        print(f"Schedule: {start_day} {start_time} to {end_day} {end_time}")
        print(f"Shift duration: {shift_duration} hours, Overnight: {is_overnight}")

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

            # Calculate normalized time for comparison with schedule
            # This needs special handling for overnight shifts
            normalized_time = rec_time  # Default to same-day time

            # For overnight shifts, adjust based on day of week
            if is_overnight:
                if day_idx == start_day_idx:
                    # On start day, keep as is (e.g., evening hours)
                    normalized_time = rec_time
                elif day_idx == end_day_idx:
                    # On end day, add days to get correct comparison
                    if day_diff == 0:  # Same day start/end means +1 day for overnight
                        normalized_time = rec_time + 24.0
                    else:
                        normalized_time = rec_time + (24.0 * day_diff)
                else:
                    # On intermediate days (for multi-day shifts)
                    day_offset = (day_idx - start_day_idx) % 7
                    normalized_time = rec_time + (24.0 * day_offset)

            # Calculate proximity to schedule start time
            start_diff = normalized_time - start_h

            # Calculate proximity to schedule end time
            end_diff = normalized_time - end_h

            # Determine if this is closer to start or end time
            is_closer_to_start = abs(start_diff) <= abs(end_diff)

            # Check if valid start time (within threshold of scheduled start)
            is_valid_start = -early_threshold <= start_diff <= late_threshold

            # Check if valid end time (within threshold of scheduled end)
            is_valid_end = -early_out_threshold <= end_diff <= grace_period

            # Check if this is overtime (after scheduled end time)
            is_overtime = normalized_time > overtime_threshold_h + grace_period

            recs.append({
                "dt": dt,
                "orig": orig,
                "time_h": rec_time,
                "orig_day": orig_day,
                "day_idx": day_idx,
                "normalized_time": normalized_time,
                "start_diff": start_diff,
                "end_diff": end_diff,
                "is_closer_to_start": is_closer_to_start,
                "is_valid_start": is_valid_start,
                "is_valid_end": is_valid_end,
                "is_overtime": is_overtime,
                "date_str": self.get_date_string(dt)
            })

        if not recs:
            return {"labeledRecords": []}

        # Sort records chronologically
        recs.sort(key=lambda x: x["dt"])

        # 3) Group records into shifts
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

            # Special handling for overnight shifts
            if is_overnight:
                # For overnight shifts, we need to consider consecutive calendar days
                # as potentially the same shift
                same_shift = False

                # If consecutive days and within reasonable time (less than shift duration + buffer)
                if date_diff <= 1 and time_diff < (shift_duration + 4):
                    same_shift = True

                # If same day, almost always same shift
                elif date_diff == 0:
                    same_shift = True

                # If on different days but the first is on start_day and second on end_day
                # and times are in the right ranges
                elif (prev_rec["day_idx"] == start_day_idx and prev_rec["time_h"] >= start_h and
                      curr_rec["day_idx"] == end_day_idx and curr_rec["time_h"] <= end_h % 24):
                    same_shift = True

                if same_shift:
                    current_shift.append(curr_rec)
                else:
                    # Finalize current shift and start a new one
                    if current_shift:
                        shifts.append(current_shift)
                    current_shift = [curr_rec]
            else:
                # For regular shifts (same day)
                # Use simpler logic - mostly just check if same day
                if date_diff == 0:
                    current_shift.append(curr_rec)
                else:
                    # Finalize current shift and start a new one
                    if current_shift:
                        shifts.append(current_shift)
                    current_shift = [curr_rec]

        # Add the last shift if it exists
        if current_shift:
            shifts.append(current_shift)

        # 4) Process each shift's records to assign labels
        labeled_results = []

        for shift_recs in shifts:
            # LOGIC 2: Split shift into regular and overtime segments
            regular_recs = [r for r in shift_recs if not r["is_overtime"]]
            overtime_recs = [r for r in shift_recs if r["is_overtime"]]

            # Process regular records first
            if regular_recs:
                self._process_shift_segment(regular_recs, labeled_results, is_overtime=False)

            # Process overtime records if any exist
            if overtime_recs:
                # Mark the first overtime record as "Overtime Start"
                first_ot_rec = overtime_recs[0]
                weekday = first_ot_rec["orig_day"] if first_ot_rec["orig_day"] else self.format_date_with_day(
                    first_ot_rec["dt"])

                labeled_results.append({
                    "record": first_ot_rec["orig"],
                    "weekday": weekday,
                    "label": "Overtime Start"
                })

                # Process intermediate overtime records if any
                for i in range(1, len(overtime_recs) - 1):
                    rec = overtime_recs[i]
                    weekday = rec["orig_day"] if rec["orig_day"] else self.format_date_with_day(rec["dt"])

                    # Alternate between Break Out and Break In
                    label = "Break Out" if i % 2 == 1 else "Break In"

                    labeled_results.append({
                        "record": rec["orig"],
                        "weekday": weekday,
                        "label": label
                    })

                # Mark the last overtime record as "Overtime End" if there's more than one
                if len(overtime_recs) > 1:
                    last_ot_rec = overtime_recs[-1]
                    weekday = last_ot_rec["orig_day"] if last_ot_rec["orig_day"] else self.format_date_with_day(
                        last_ot_rec["dt"])

                    labeled_results.append({
                        "record": last_ot_rec["orig"],
                        "weekday": weekday,
                        "label": "Overtime End"
                    })

        # Sort results by original timestamp order
        labeled_results.sort(key=lambda x: self.parse_record_datetime(x["record"]))

        return {"labeledRecords": labeled_results}

    def _process_shift_segment(self, shift_recs, labeled_results, is_overtime=False):
        """Helper method to process a segment of records (regular or overtime)"""
        num_records = len(shift_recs)

        if num_records == 0:
            return

        if num_records == 1:
            # Single record - classify based on proximity to schedule times
            rec = shift_recs[0]
            weekday = rec["orig_day"] if rec["orig_day"] else self.format_date_with_day(rec["dt"])

            # Logic 2 specific: Override for overtime records
            if is_overtime:
                label = "Overtime Start"  # Single OT record becomes Overtime Start
            else:
                # Determine if this is closer to start or end time
                if rec["is_valid_end"] and not rec["is_valid_start"]:
                    label = "Time Out"
                elif rec["is_valid_start"] and not rec["is_valid_end"]:
                    label = "Time In"
                elif rec["is_closer_to_start"]:
                    label = "Time In"
                else:
                    label = "Time Out"

            labeled_results.append({
                "record": rec["orig"],
                "weekday": weekday,
                "label": label
            })

        elif num_records == 2:
            # Two records - determine which is Time In and which is Time Out
            # based on proximity to schedule times
            rec1, rec2 = shift_recs

            weekday1 = rec1["orig_day"] if rec1["orig_day"] else self.format_date_with_day(rec1["dt"])
            weekday2 = rec2["orig_day"] if rec2["orig_day"] else self.format_date_with_day(rec2["dt"])

            # Logic 2 specific: Override for overtime records
            if is_overtime:
                label1 = "Overtime Start"
                label2 = "Overtime End"
            else:
                # First, try to determine based on valid start/end times
                if rec1["is_valid_start"] and rec2["is_valid_end"]:
                    # Clear case: first is start, second is end
                    label1 = "Time In"
                    label2 = "Time Out"
                elif rec1["is_valid_end"] and rec2["is_valid_start"]:
                    # Unusual case: first is end, second is start (shouldn't happen often)
                    label1 = "Time Out"
                    label2 = "Time In"
                else:
                    # Determine based on proximity to schedule times
                    if rec1["is_closer_to_start"] and not rec2["is_closer_to_start"]:
                        label1 = "Time In"
                        label2 = "Time Out"
                    elif not rec1["is_closer_to_start"] and rec2["is_closer_to_start"]:
                        label1 = "Time Out"
                        label2 = "Time In"
                    else:
                        # If both are closer to the same endpoint, use chronological order as fallback
                        label1 = "Time In"
                        label2 = "Time Out"

            labeled_results.append({
                "record": rec1["orig"],
                "weekday": weekday1,
                "label": label1
            })

            labeled_results.append({
                "record": rec2["orig"],
                "weekday": weekday2,
                "label": label2
            })

        else:
            # More than 2 records - determine Time In, Time Out and breaks

            # Logic 2 specific: Labels for overtime records
            if is_overtime:
                first_label = "Overtime Start"
                last_label = "Overtime End"
            else:
                first_label = "Time In"
                last_label = "Time Out"

            # Find records closest to start and end times
            start_rec = min(shift_recs, key=lambda x: abs(x["start_diff"]))
            end_rec = min(shift_recs, key=lambda x: abs(x["end_diff"]))

            # Must be different records
            if start_rec == end_rec:
                # If same record, find next best match for end time
                remaining = [r for r in shift_recs if r != start_rec]
                end_rec = min(remaining, key=lambda x: abs(x["end_diff"]))

            # Get indices of start and end records
            start_idx = shift_recs.index(start_rec)
            end_idx = shift_recs.index(end_rec)

            # Sort start and end indices to get chronological order
            if start_idx > end_idx:
                # This is an unusual case where end time record comes before start time record
                # We'll still process in chronological order, but adjust labels accordingly
                first_rec, last_rec = end_rec, start_rec
                first_label, last_label = last_label, first_label
                first_idx, last_idx = end_idx, start_idx
            else:
                first_rec, last_rec = start_rec, end_rec
                first_idx, last_idx = start_idx, end_idx

            # Process first record (Time In or Overtime Start)
            weekday = first_rec["orig_day"] if first_rec["orig_day"] else self.format_date_with_day(first_rec["dt"])
            labeled_results.append({
                "record": first_rec["orig"],
                "weekday": weekday,
                "label": first_label
            })

            # Process last record (Time Out or Overtime End)
            # Skip if it's the same as the first record (shouldn't happen)
            if last_rec != first_rec:
                weekday = last_rec["orig_day"] if last_rec["orig_day"] else self.format_date_with_day(last_rec["dt"])
                labeled_results.append({
                    "record": last_rec["orig"],
                    "weekday": weekday,
                    "label": last_label
                })

            # Process intermediate records as break pairs
            intermediate_recs = [r for i, r in enumerate(shift_recs)
                                 if i != first_idx and i != last_idx]

            # Process intermediate records in pairs if possible
            for i in range(0, len(intermediate_recs), 2):
                if i < len(intermediate_recs):
                    # Break Out
                    rec = intermediate_recs[i]
                    weekday = rec["orig_day"] if rec["orig_day"] else self.format_date_with_day(rec["dt"])
                    labeled_results.append({
                        "record": rec["orig"],
                        "weekday": weekday,
                        "label": "Break Out"
                    })

                if i + 1 < len(intermediate_recs):
                    # Break In
                    rec = intermediate_recs[i + 1]
                    weekday = rec["orig_day"] if rec["orig_day"] else self.format_date_with_day(rec["dt"])
                    labeled_results.append({
                        "record": rec["orig"],
                        "weekday": weekday,
                        "label": "Break In"
                    })

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

            # Determine if overnight shift
            is_overnight = (day_diff == 0 and end_h <= start_h) or day_diff > 0

            # Case 1: Same day schedule (not overnight)
            if not is_overnight and dt_day_idx == start_day_idx:
                if start_h <= dt_time <= end_h:
                    return schedule

            # Case 2: Overnight shift
            elif is_overnight:
                # Check if dt is on start day after start time
                if dt_day_idx == start_day_idx and dt_time >= start_h:
                    return schedule

                # Check if dt is on end day before end time
                if dt_day_idx == end_day_idx and dt_time <= end_h % 24:
                    return schedule

                # Check if dt is on a day between start and end day (for multi-day shifts)
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
def execute_logic2(recorded_times, schedule_or_schedules):
    """
    Logic 2 processor that extends Logic 1 with overtime detection.
    This function can handle both a single schedule or a list of schedules.
    """
    manager = OvertimeScheduleManager()

    # Check if we have a list of schedules or a single schedule
    if isinstance(schedule_or_schedules, list):
        # If we have a list of schedules, use the multi-schedule function
        return manager.process_recorded_times_with_schedules(recorded_times, schedule_or_schedules)
    else:
        # If we have a single schedule, use the original function
        return manager.process_recorded_times(recorded_times, schedule_or_schedules)


# Still provide direct access to the individual functions if needed
process_with_single_schedule = OvertimeScheduleManager().process_recorded_times
process_with_schedules = OvertimeScheduleManager().process_recorded_times_with_schedules