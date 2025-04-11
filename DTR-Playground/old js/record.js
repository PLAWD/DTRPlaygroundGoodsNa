// record.js

// Initialize Flatpickr on the main datetime input for recording times.
flatpickr("#schedule_datetime", {
  enableTime: true,
  dateFormat: "Y-m-d H:i",
  time_24hr: false
});

// Utility function: Format datetime to "Day - DD/MM/YYYY - HH:MM AM/PM"
function formatDateTime(input) {
  let date = new Date(input);
  let weekday = date.toLocaleString('en-US', { weekday: 'long' });
  let day = date.getDate().toString().padStart(2, '0');
  let month = (date.getMonth() + 1).toString().padStart(2, '0');
  let year = date.getFullYear();
  let hours = date.getHours();
  let minutes = date.getMinutes().toString().padStart(2, '0');
  let ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${weekday} - ${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
}

// Function to create and show the "Add Record Below" modal.
function showAddRecordModal(parentRecord) {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.classList.add('modal-overlay');
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = '0';
  modalOverlay.style.left = '0';
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
  modalContent.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

  // Create a form inside the modal
  modalContent.innerHTML = `
    <h3>Add Record Below</h3>
    <label for="new-record-datetime">Select Date & Time:</label>
    <input type="datetime-local" id="new-record-datetime" style="width:100%; margin-bottom:10px;">
    <div style="text-align:right;">
      <button id="modal-cancel-btn" style="margin-right:8px;">Cancel</button>
      <button id="modal-save-btn">Save</button>
    </div>
  `;

  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  // Cancel button event
  document.getElementById('modal-cancel-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.body.removeChild(modalOverlay);
  });

  // Save button event
  document.getElementById('modal-save-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    const dtInput = document.getElementById('new-record-datetime').value;
    if (!dtInput) {
      alert("Please select a date and time.");
      return;
    }
    // Format the input using our formatDateTime function
    let formatted = formatDateTime(dtInput);
    // Create a new record entry
    const newEntry = createRecordEntry(formatted);
    // Insert the new entry immediately after the parent record
    parentRecord.parentNode.insertBefore(newEntry, parentRecord.nextSibling);
    // Remove the modal
    document.body.removeChild(modalOverlay);
  });
}

// Function to create a record entry element given a time string.
function createRecordEntry(timeStr) {
  // Main container for the record entry
  const newRecord = document.createElement('div');
  newRecord.classList.add('record-entry');
  newRecord.style.display = 'flex';
  newRecord.style.alignItems = 'center';
  newRecord.style.padding = '6px 10px';
  newRecord.style.borderBottom = '1px solid #eee';

  // Left container (holds time text + logic label)
  const leftContainer = document.createElement('div');
  leftContainer.classList.add('record-left-container');
  leftContainer.style.display = 'flex';
  leftContainer.style.alignItems = 'center';
  leftContainer.style.gap = '8px';

  // Time text
  const recordText = document.createElement('span');
  recordText.classList.add('record-text');
  recordText.textContent = timeStr;
  leftContainer.appendChild(recordText);

  // Action container for vertical ellipsis and its menu
  const actionContainer = document.createElement('div');
  actionContainer.style.position = 'relative';
  actionContainer.style.marginLeft = 'auto';

  // Vertical ellipsis button
  const actionButton = document.createElement('button');
  actionButton.innerHTML = "&#8942;";
  actionButton.classList.add('action-button');
  actionButton.style.border = 'none';
  actionButton.style.background = 'transparent';
  actionButton.style.fontSize = '1.2em';
  actionButton.style.cursor = 'pointer';

  // Hidden menu for actions
  const actionMenu = document.createElement('div');
  actionMenu.classList.add('action-menu');
  actionMenu.style.display = 'none';
  actionMenu.style.position = 'absolute';
  actionMenu.style.right = '0px';
  actionMenu.style.top = '24px';
  actionMenu.style.background = '#fff';
  actionMenu.style.border = '1px solid #ccc';
  actionMenu.style.padding = '5px';
  actionMenu.style.zIndex = '1000';

  // "Add Record Below" item
  const addBelowItem = document.createElement('div');
  addBelowItem.textContent = "Add Record Below";
  addBelowItem.style.padding = '5px';
  addBelowItem.style.cursor = 'pointer';
  addBelowItem.addEventListener('click', (e) => {
    e.stopPropagation();
    showAddRecordModal(newRecord);
    actionMenu.style.display = 'none';
  });

  // "Edit Record" item
  const editItem = document.createElement('div');
  editItem.textContent = "Edit Record";
  editItem.style.padding = '5px';
  editItem.style.cursor = 'pointer';
  editItem.addEventListener('click', (e) => {
    e.stopPropagation();
    alert("Edit Record (not implemented yet).");
    actionMenu.style.display = 'none';
  });

  // "Delete Record" item
  const deleteItem = document.createElement('div');
  deleteItem.textContent = "Delete Record";
  deleteItem.style.padding = '5px';
  deleteItem.style.cursor = 'pointer';
  deleteItem.addEventListener('click', (e) => {
    e.stopPropagation();
    newRecord.remove();
    actionMenu.style.display = 'none';
  });

  // Append menu items to the menu
  actionMenu.appendChild(addBelowItem);
  actionMenu.appendChild(editItem);
  actionMenu.appendChild(deleteItem);

  // Toggle menu when ellipsis button is clicked
  actionButton.addEventListener('click', (e) => {
    e.stopPropagation();
    actionMenu.style.display = (actionMenu.style.display === 'block') ? 'none' : 'block';
  });

  // Hide menu when clicking outside
  document.addEventListener('click', () => {
    actionMenu.style.display = 'none';
  });

  // Build the action container
  actionContainer.appendChild(actionButton);
  actionContainer.appendChild(actionMenu);

  // Append left container and action container to the main record container
  newRecord.appendChild(leftContainer);
  newRecord.appendChild(actionContainer);

  return newRecord;
}

// Handle manual recording
document.getElementById('record-time').addEventListener('click', function() {
  const datetimeInput = document.getElementById('schedule_datetime').value;
  const recordBox = document.getElementById('record-box');
  if (datetimeInput) {
    if (recordBox.textContent.trim() === "No time recorded") {
      recordBox.textContent = "";
    }
    let formatted = formatDateTime(datetimeInput);
    recordBox.appendChild(createRecordEntry(formatted));
  } else {
    alert("Please select a date and time before recording.");
  }
});

// Save record box info as JSON file
document.getElementById('save-info').addEventListener('click', function() {
  const recordBox = document.getElementById('record-box');
  if (recordBox.textContent.trim() === "No time recorded") {
    alert("No records to save.");
    return;
  }
  let records = [];
  recordBox.childNodes.forEach(child => {
    if (child.firstChild && child.firstChild.textContent.trim()) {
      // The left container's text is the first child of record-entry.
      records.push(child.firstChild.textContent.trim());
    }
  });
  let jsonData = { "recordedTimes": records };
  let jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'recorded_times.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

// Upload record box info
document.getElementById('upload-info').addEventListener('click', function() {
  const fileInput = document.getElementById('upload-file').click();
  fileInput.value = ''; // Reset the input value
  fileInput.click();
});
document.getElementById('upload-file').addEventListener('change', function() {
  const fileInput = document.getElementById('upload-file');
  if (fileInput.files.length > 0) {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    fetch('/upload', { method: 'POST', body: formData })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          const recordBox = document.getElementById('record-box');
          recordBox.innerHTML = "";
          const lines = data.content.split('\n');
          lines.forEach(line => {
            if (line.trim() !== "") {
              recordBox.appendChild(createRecordEntry(line.trim()));
            }
          });
        } else {
          alert(data.message);
        }
      })
      .catch(error => {
        alert("Error uploading file.");
      });
  }
});

// Clear record box
document.getElementById('clear-info').addEventListener('click', function() {
  document.getElementById('record-box').innerText = "No time recorded";
  document.getElementById('upload-file').value = ''; // Reset the input when clearing
});
