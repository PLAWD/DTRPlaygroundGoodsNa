// logic2.js - Implements alternative time record processing
// This follows a similar pattern to logic1.js but with a different processing approach

function applyLogic2() {
  const recordBox = document.getElementById('record-box');
  const entries = Array.from(recordBox.getElementsByClassName('record-entry'));

  // Get the record text from .record-left-container > .record-text
  let recordedTimes = entries.map(entry => {
    const leftContainer = entry.querySelector('.record-left-container');
    if (leftContainer) {
      const recordText = leftContainer.querySelector('.record-text');
      return recordText ? recordText.textContent.trim() : "";
    }
    return "";
  }).filter(time => time !== "");

  console.log("Logic2 - Recorded Times:", recordedTimes);
  if (recordedTimes.length === 0) {
    alert("No recorded times to process.");
    return;
  }

  // Get schedules from the UI
  const schedules = [];

  // Get the primary schedule from existing UI elements
  schedules.push({
    start_day: document.getElementById('schedule-day')?.value || "Monday",
    start_time: document.getElementById('start-time')?.value || "6:00 AM",
    end_day: document.getElementById('schedule-day')?.value || "Monday", // Same as start_day if not specified
    end_time: document.getElementById('end-time')?.value || "2:00 PM"
  });

  // You can add code here to get additional schedules if your UI supports that

  // Payload for the backend
  const payload = {
    recordedTimes: recordedTimes,
    schedules: schedules
  };

  console.log("Logic2 - Sending payload:", payload);

  // Make request to Logic 2 endpoint (assuming you've implemented it on the backend)
  fetch('/execute_logic2', {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.message || `Server returned ${response.status}`);
      });
    }
    return response.json();
  })
  .then(data => {
    console.log("Logic2 - Received response:", data);

    if (data.status === "success" && data.labeledRecords) {
      // Apply labels to the UI
      applyLabelsToUI(data.labeledRecords, entries);
    } else {
      throw new Error(data.message || "Unknown error occurred");
    }
  })
  .catch(err => {
    console.error("Logic2 - Error:", err);
    alert("Error executing Logic 2: " + err.message);

    // Uncheck the checkbox on error
    const logic2Checkbox = document.getElementById('logic2');
    if (logic2Checkbox) {
      logic2Checkbox.checked = false;
    }
  });
}

function applyLabelsToUI(labeledRecords, entries) {
  // First, create a map of record text to label for quick lookup
  const recordLabelMap = {};
  labeledRecords.forEach(rec => {
    recordLabelMap[rec.record] = rec.label;
  });

  // Then apply labels to matching entries
  let labelCount = 0;
  entries.forEach((entry, index) => {
    // Find the record text
    const leftContainer = entry.querySelector('.record-left-container');
    if (!leftContainer) return;

    const recordText = leftContainer.querySelector('.record-text');
    if (!recordText) return;

    const recordValue = recordText.textContent.trim();
    if (!recordValue) return;

    // Look up the label for this record
    const label = recordLabelMap[recordValue];
    if (!label) {
      console.log(`Logic2 - No label found for record: "${recordValue}"`);
      return;
    }

    // Remove any existing logic label
    let oldLabel = leftContainer.querySelector('.logic-label');
    if (oldLabel) oldLabel.remove();

    // Create a new logic label
    let labelSpan = document.createElement('span');
    labelSpan.classList.add('logic-label');
    labelSpan.textContent = label;

    // Color coding - different color scheme from Logic 1
    if (label === "Time In" || label === "IN") {
      labelSpan.style.color = "#4CAF50"; // Green
    } else if (label === "Time Out" || label === "OUT") {
      labelSpan.style.color = "#F44336"; // Red
    } else if (label === "Break Out") {
      labelSpan.style.color = "#FF9800"; // Orange
    } else if (label === "Break In") {
      labelSpan.style.color = "#2196F3"; // Blue
    } else if (label === "Overtime Start") {
      labelSpan.style.color = "#9C27B0"; // Purple
    } else if (label === "Overtime End") {
      labelSpan.style.color = "#795548"; // Brown
    }

    // Append the new logic label to the left container
    leftContainer.appendChild(labelSpan);
    labelCount++;
  });

  console.log(`Logic2 - Applied labels to ${labelCount}/${entries.length} entries`);
}

// Immediately apply logic when "Logic 2" checkbox is checked,
// and remove logic labels when it is deselected.
document.addEventListener('DOMContentLoaded', function() {
  const logic2Checkbox = document.getElementById('logic2');
  if (logic2Checkbox) {
    logic2Checkbox.addEventListener('change', function() {
      console.log("Logic2 checkbox changed:", this.checked);

      // If Logic 1 is checked, uncheck it
      const logic1Checkbox = document.getElementById('logic1');
      if (this.checked && logic1Checkbox && logic1Checkbox.checked) {
        logic1Checkbox.checked = false;
        // This should trigger the logic1 change event which will remove its labels
      }

      if (this.checked) {
        applyLogic2();
      } else {
        // Remove logic labels from all record entries
        const labels = document.querySelectorAll('.record-entry .logic-label');
        labels.forEach(label => label.remove());
      }
    });
  } else {
    console.error("Logic2 checkbox element not found!");
  }
});