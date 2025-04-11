// Enhanced logic1.js with flexible element selection
document.addEventListener('DOMContentLoaded', function() {
  // Make sure the logic1 checkbox exists
  const logic1Checkbox = document.getElementById('logic1');
  if (!logic1Checkbox) {
    console.error("Logic1 checkbox element not found!");
    return;
  }

  console.log("Logic1 checkbox found, attaching event listener");
  logic1Checkbox.addEventListener('change', function() {
    console.log("Logic1 checkbox changed:", this.checked);
    if (this.checked) {
      applyLogic1();
    } else {
      // Remove logic labels
      const labels = document.querySelectorAll('.record-entry .logic-label');
      labels.forEach(label => label.remove());
    }
  });
});

function applyLogic1() {
  console.log("applyLogic1 function called");

  // Make sure record-box exists
  const recordBox = document.getElementById('record-box');
  if (!recordBox) {
    console.error("Record box element not found!");
    alert("Record box not found. Please check the page structure.");
    return;
  }

  // Get all record entries
  const entries = Array.from(recordBox.getElementsByClassName('record-entry'));
  console.log("Found record entries:", entries.length);

  // Extract recorded times
  let recordedTimes = entries.map(entry => {
    const leftContainer = entry.querySelector('.record-left-container');
    if (leftContainer) {
      const recordText = leftContainer.querySelector('.record-text');
      return recordText ? recordText.textContent.trim() : "";
    }
    return "";
  }).filter(time => time !== "");

  console.log("Recorded Times:", recordedTimes);
  if (recordedTimes.length === 0) {
    alert("No recorded times to process.");
    return;
  }

  // Try to find schedule elements with multiple possible IDs
  const scheduleDayElem =
    document.getElementById('schedule-day') ||
    document.getElementById('scheduleDay') ||
    document.querySelector('[name="schedule-day"]') ||
    document.querySelector('select[data-schedule="day"]') ||
    document.querySelector('.schedule-day');

  const startTimeElem =
    document.getElementById('start-time') ||
    document.getElementById('startTime') ||
    document.querySelector('[name="start-time"]') ||
    document.querySelector('input[data-schedule="start-time"]') ||
    document.querySelector('.start-time');

  const endTimeElem =
    document.getElementById('end-time') ||
    document.getElementById('endTime') ||
    document.querySelector('[name="end-time"]') ||
    document.querySelector('input[data-schedule="end-time"]') ||
    document.querySelector('.end-time');

  console.log("Schedule elements found:", {
    scheduleDayElem, startTimeElem, endTimeElem
  });

  // Log all available schedule-related elements to help debug
  console.log("All schedule-related elements on page:");
  document.querySelectorAll('[id*="schedule"],[id*="time"],[class*="schedule"],[class*="time"]').forEach(el => {
    console.log(`Element: ${el.tagName}, ID: ${el.id}, Class: ${el.className}`);
  });

  // Fall back to default values if we can't find the elements
  const scheduleDay = scheduleDayElem ? scheduleDayElem.value : "Monday";
  const startTime = startTimeElem ? startTimeElem.value : "6:00 AM";
  const endTime = endTimeElem ? endTimeElem.value : "2:00 PM";

  console.log("Using schedule values:", {scheduleDay, startTime, endTime});

  // Create schedule
  const schedules = [{
    start_day: scheduleDay,
    start_time: startTime,
    end_day: scheduleDay, // Same as start day for now
    end_time: endTime
  }];
  
  // Create payload
  const payload = {
    recordedTimes: recordedTimes,
    schedules: schedules
  };
  
  console.log("Sending payload to /execute_logic1:", JSON.stringify(payload, null, 2));
  
  // Send request with error handling
  fetch('/execute_logic1', {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(response => {
    console.log("Response status:", response.status);
    return response.json().then(data => {
      console.log("Raw response data:", data);
      if (!response.ok) {
        throw new Error(data.message || `Server returned ${response.status}`);
      }
      return data;
    });
  })
  .then(data => {
    console.log("Processing response data:", data);
    
    if (data.status === "success" && data.labeledRecords) {
      console.log("Applying labels to UI, records:", data.labeledRecords.length);
      applyLabelsToUI(data.labeledRecords, entries);
    } else {
      throw new Error(data.message || "Unknown error occurred");
    }
  })
  .catch(err => {
    console.error("Error executing Logic 1:", err);
    alert("Error executing logic: " + err.message);
    
    // Uncheck the checkbox since there was an error
    const logic1Checkbox = document.getElementById('logic1');
    if (logic1Checkbox) {
      logic1Checkbox.checked = false;
    }
  });
}

function applyLabelsToUI(labeledRecords, entries) {
    console.log("In applyLabelsToUI function");
    
    // First, create a map of record text to label for quick lookup
    const recordLabelMap = {};
    labeledRecords.forEach(rec => {
        recordLabelMap[rec.record] = rec.label;
    });
    
    console.log("Record-label map created:", recordLabelMap);
    
    // Then apply labels to matching entries
    let labelCount = 0;
    entries.forEach((entry, index) => {
        // Find the record text
        const leftContainer = entry.querySelector('.record-left-container');
        if (!leftContainer) {
            console.log(`Entry ${index} has no left container`);
            return;
        }
        
        const recordText = leftContainer.querySelector('.record-text');
        if (!recordText) {
            console.log(`Entry ${index} has no record text element`);
            return;
        }
        
        const recordValue = recordText.textContent.trim();
        if (!recordValue) {
            console.log(`Entry ${index} has empty record text`);
            return;
        }
        
        // Look up the label for this record
        const label = recordLabelMap[recordValue];
        if (!label) {
            console.log(`No label found for record: "${recordValue}"`);
            return;
        }
        
        // Remove any existing logic label
        let oldLabel = leftContainer.querySelector('.logic-label');
        if (oldLabel) {
            console.log(`Removing existing label from entry ${index}`);
            oldLabel.remove();
        }
        
        // Create a new logic label
        let labelSpan = document.createElement('span');
        labelSpan.classList.add('logic-label');
        labelSpan.textContent = label;
        
        // Color coding - FIXED: proper color assignment for clarity
        if (label === "Time In") {
            labelSpan.style.color = "#28a745"; // Green
        } else if (label === "Time Out") {
            labelSpan.style.color = "#dc3545"; // Red
        } else if (label === "Break Out") { 
            // Break Out = leaving for break
            labelSpan.style.color = "#fd7e14"; // Orange
        } else if (label === "Break In") {
            // Break In = returning from break
            labelSpan.style.color = "#007bff"; // Blue
        }
        
        // Append the new logic label to the left container
        leftContainer.appendChild(labelSpan);
        labelCount++;
        console.log(`Applied "${label}" label to entry ${index}`);
    });
    
    console.log(`Applied labels to ${labelCount}/${entries.length} entries`);
}