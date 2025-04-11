// Initialize Flatpickr on schedule start and end time inputs.
flatpickr("#start-time", {
  enableTime: true,
  noCalendar: true,
  dateFormat: "h:i K",
  time_24hr: false
});
flatpickr("#end-time", {
  enableTime: true,
  noCalendar: true,
  dateFormat: "h:i K",
  time_24hr: false
});

// Utility function: Format time (if not already in AM/PM format).
function formatTime(timeStr) {
  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    return timeStr.trim();
  }
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours, 10);
  const m = minutes;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// Helper: Convert a time string (e.g., "6:00 PM") into a numeric value (in hours, 24hr format)
function parseTime(timeStr) {
  let [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":");
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);
  if (modifier.toUpperCase() === "PM" && hours !== 12) {
    hours += 12;
  }
  if (modifier.toUpperCase() === "AM" && hours === 12) {
    hours = 0;
  }
  return hours + minutes / 60;
}

// Helper: Get the next day of the week given the current day string.
function getNextDay(day) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  let index = days.indexOf(day);
  if (index === -1) return day;
  return days[(index + 1) % 7];
}

// Schedule Handling
// Holds schedule objects: { start_day, start_time, end_day, end_time }
let schedules = [];

// Modal for editing a schedule item.
function openEditModal(index) {
  const sched = schedules[index];
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.classList.add('modal-overlay');
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = 0;
  modalOverlay.style.left = 0;
  modalOverlay.style.width = '100%';
  modalOverlay.style.height = '100%';
  modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalOverlay.style.display = 'flex';
  modalOverlay.style.justifyContent = 'center';
  modalOverlay.style.alignItems = 'center';
  modalOverlay.style.zIndex = '2000';

  // Create modal content container
  const modalContent = document.createElement('div');
  modalContent.classList.add('modal-content');
  modalContent.style.backgroundColor = '#fff';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '5px';
  modalContent.style.width = '300px';

  // Insert the edit form into the modal with separate day fields.
  modalContent.innerHTML = `
    <h3>Edit Schedule</h3>
    <form id="edit-schedule-form">
      <label for="edit-start-day">Start Day:</label>
      <select id="edit-start-day" name="start_day" required>
        <option value="">--Select Day--</option>
        <option value="Monday">Monday</option>
        <option value="Tuesday">Tuesday</option>
        <option value="Wednesday">Wednesday</option>
        <option value="Thursday">Thursday</option>
        <option value="Friday">Friday</option>
        <option value="Saturday">Saturday</option>
        <option value="Sunday">Sunday</option>
      </select>
      <br><br>
      <label for="edit-start-time">Start:</label>
      <input type="text" id="edit-start-time" name="start_time" required>
      <br><br>
      <label for="edit-end-time">End:</label>
      <input type="text" id="edit-end-time" name="end_time" required>
      <br><br>
      <label for="edit-end-day">End Day:</label>
      <select id="edit-end-day" name="end_day" required>
        <option value="">--Select Day--</option>
        <option value="Monday">Monday</option>
        <option value="Tuesday">Tuesday</option>
        <option value="Wednesday">Wednesday</option>
        <option value="Thursday">Thursday</option>
        <option value="Friday">Friday</option>
        <option value="Saturday">Saturday</option>
        <option value="Sunday">Sunday</option>
      </select>
      <br><br>
      <button type="submit">Save Changes</button>
      <button type="button" id="cancel-edit">Cancel</button>
    </form>
  `;
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // Pre-fill the form with the existing schedule values.
  document.getElementById('edit-start-day').value = sched.start_day;
  document.getElementById('edit-start-time').value = sched.start_time;
  document.getElementById('edit-end-time').value = sched.end_time;
  document.getElementById('edit-end-day').value = sched.end_day;

  // Initialize Flatpickr for the edit modal fields.
  flatpickr("#edit-start-time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "h:i K",
    time_24hr: false
  });
  flatpickr("#edit-end-time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "h:i K",
    time_24hr: false
  });

  // Handle form submission.
  document.getElementById('edit-schedule-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const newStartDay = document.getElementById('edit-start-day').value;
    const newStart = document.getElementById('edit-start-time').value;
    const newEnd = document.getElementById('edit-end-time').value;
    const newEndDay = document.getElementById('edit-end-day').value;
    if (!newStartDay || !newStart || !newEnd || !newEndDay) {
      alert("Please fill in all fields.");
      return;
    }
    // Update the schedule item.
    schedules[index] = {
      start_day: newStartDay,
      start_time: newStart,
      end_time: newEnd,
      end_day: newEndDay
    };
    updateScheduleList();
    document.body.removeChild(modalOverlay);
  });

  // Handle cancel action.
  document.getElementById('cancel-edit').addEventListener('click', function() {
    document.body.removeChild(modalOverlay);
  });
}

// Modal for delete confirmation.
function openDeleteModal(index) {
  const modalOverlay = document.createElement('div');
  modalOverlay.classList.add('modal-overlay');
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = 0;
  modalOverlay.style.left = 0;
  modalOverlay.style.width = '100%';
  modalOverlay.style.height = '100%';
  modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalOverlay.style.display = 'flex';
  modalOverlay.style.justifyContent = 'center';
  modalOverlay.style.alignItems = 'center';
  modalOverlay.style.zIndex = '2000';

  const modalContent = document.createElement('div');
  modalContent.classList.add('modal-content');
  modalContent.style.backgroundColor = '#fff';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '5px';
  modalContent.style.width = '300px';
  modalContent.innerHTML = `
    <h3>Confirm Delete</h3>
    <p>Are you sure you want to delete this schedule?</p>
    <button id="confirm-delete">Yes, Delete</button>
    <button id="cancel-delete">Cancel</button>
  `;
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  document.getElementById('confirm-delete').addEventListener('click', function() {
    schedules.splice(index, 1);
    updateScheduleList();
    document.body.removeChild(modalOverlay);
  });

  document.getElementById('cancel-delete').addEventListener('click', function() {
    document.body.removeChild(modalOverlay);
  });
}

function updateScheduleList() {
    const scheduleList = document.getElementById('schedule-list');
    const tableBody = scheduleList.querySelector('tbody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Clear previous list
    
    schedules.forEach((sched, index) => {
        const row = document.createElement('tr');
        const startTime = formatTime(sched.start_time);
        const endTime = formatTime(sched.end_time);
        
        row.innerHTML = `
            <td>${sched.start_day}</td>
            <td>${startTime}</td>
            <td>${sched.end_day}</td>
            <td>${endTime}</td>
            <td>
                <div class="action-buttons">
                    <button class="edit-btn" onclick="openEditModal(${index})">Edit</button>
                    <button class="delete-btn" onclick="openDeleteModal(${index})">Delete</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

document.getElementById('schedule-form').addEventListener('submit', function(event) {
  event.preventDefault();
  const start_day = document.getElementById('start-day').value;
  const start_time = document.getElementById('start-time').value;
  const end_time = document.getElementById('end-time').value;
  const end_day = document.getElementById('end-day').value;
  if (!start_day || !start_time || !end_time || !end_day) {
    alert("Please fill in all schedule fields.");
    return;
  }
  const newSchedule = { start_day, start_time, end_day, end_time };
  schedules.push(newSchedule);
  document.getElementById('schedule-form').reset();
  updateScheduleList();
  document.getElementById('schedule-message').innerText = "Schedule updated successfully.";
  setTimeout(() => {
    document.getElementById('schedule-message').innerText = "";
  }, 3000);
});

document.getElementById('save-schedule').addEventListener('click', function() {
  if (schedules.length === 0) {
    alert("No schedules to save.");
    return;
  }
  const jsonData = { schedules: schedules };
  const jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'schedules.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

document.getElementById('load-schedule').addEventListener('click', function() {
  const fileInput = document.getElementById('upload-schedule-file').click();
  fileInput.value = ''; // Reset the file input
  fileInput.click();
});
document.getElementById('upload-schedule-file').addEventListener('change', function() {
  const fileInput = document.getElementById('upload-schedule-file');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.schedules && Array.isArray(data.schedules)) {
          // Uncheck all logic checkboxes when new schedules are uploaded
          const logicCheckboxes = document.querySelectorAll('#logic1, #logic2, #logic3');
          logicCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
          });
          
          schedules = data.schedules;
          updateScheduleList();
          document.getElementById('schedule-message').innerText = "Schedules loaded successfully.";
          setTimeout(() => {
            document.getElementById('schedule-message').innerText = "";
          }, 3000);
        } else {
          alert("JSON file does not contain schedules.");
        }
      } catch (err) {
        alert("Error parsing schedule file.");
      }
    };
    reader.readAsText(file);
  }
});

document.getElementById('clear-schedule').addEventListener('click', function() {
  schedules = [];
  updateScheduleList();
  document.getElementById('schedule-message').innerText = "Schedules cleared.";
  document.getElementById('upload-schedule-file').value = ''; // Reset the file input
  
  // Uncheck all logic checkboxes when schedules are cleared
  const logicCheckboxes = document.querySelectorAll('#logic1, #logic2, #logic3');
  logicCheckboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  setTimeout(() => {
    document.getElementById('schedule-message').innerText = "";
  }, 3000);
});

// Easter Egg: If a user records November 13, 1987, open a YouTube video in fullscreen and max volume.
document.getElementById('record-time').addEventListener('click', function() {
  const dateValue = document.getElementById('schedule_datetime').value;
  if (!dateValue) return;

  const recordedDate = new Date(dateValue);
  // Check if the recorded date is November 13, 1987 (Note: getMonth() returns 0-indexed months, so November is 10).
  if (
    recordedDate.getFullYear() === 1987 &&
    recordedDate.getMonth() === 10 &&
    recordedDate.getDate() === 13
  ) {
    const youtubeURL = "https://www.youtube.com/embed/Grs8rgV3j0s?autoplay=1&fs=1";
    const videoWindow = window.open(youtubeURL, '_blank');
    if (videoWindow) {
      // Attempt to request fullscreen on the new window after load.
      videoWindow.addEventListener('load', function() {
        const docEl = videoWindow.document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen();
        }
      });
      // Note: Adjusting volume programmatically for a YouTube embed is generally not supported due to browser security.
    }
  }
});
