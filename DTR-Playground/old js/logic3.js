function applyLogic3() {
    const recordBox = document.getElementById('record-box');
    const entries = Array.from(recordBox.getElementsByClassName('record-entry'));
    
    let recordedTimes = entries.map(entry => {
        const leftContainer = entry.querySelector('.record-left-container');
        if (leftContainer) {
            const recordText = leftContainer.querySelector('.record-text');
            return recordText ? recordText.textContent.trim() : "";
        }
        return "";
    }).filter(time => time !== "");

    // Get schedules from schedule table
    const scheduleList = document.getElementById('schedule-list');
    const scheduleItems = Array.from(scheduleList.querySelector('tbody').getElementsByTagName('tr')).map(row => {
        const cells = row.getElementsByTagName('td');
        return {
            start_day: cells[0].textContent.trim(),
            start_time: cells[1].textContent.trim(),
            end_day: cells[2].textContent.trim(),
            end_time: cells[3].textContent.trim()
        };
    });

    const payload = {
        recordedTimes: recordedTimes,
        schedules: {
            schedules: scheduleItems
        }
    };

    console.log("Sending payload to logic3:", payload);

    fetch('/execute_logic3', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            // Clear existing records
            recordBox.innerHTML = '';
            
            // Add review warning if needed
            if (data.needs_review) {
                const reviewRow = document.createElement('div');
                reviewRow.classList.add('review-row');
                
                const warningIcon = document.createElement('span');
                warningIcon.innerHTML = '⚠️';
                warningIcon.classList.add('warning-icon');
                
                const warningText = document.createElement('span');
                warningText.textContent = 'Marked for Review';
                warningText.classList.add('warning-text');
                
                const reviewBtn = document.createElement('button');
                reviewBtn.textContent = 'Review';
                reviewBtn.classList.add('review-btn');
                reviewBtn.onclick = () => showReviewModal(data);
                
                reviewRow.appendChild(warningIcon);
                reviewRow.appendChild(warningText);
                reviewRow.appendChild(reviewBtn);
                recordBox.appendChild(reviewRow);
            }
            
            // Display records
            data.original_records.forEach(record => {
                const entry = document.createElement('div');
                entry.classList.add('record-entry');
                
                // Create left container for record text and label
                const leftContainer = document.createElement('div');
                leftContainer.classList.add('record-left-container');
                leftContainer.style.display = 'flex';
                leftContainer.style.alignItems = 'center';
                leftContainer.style.gap = '8px';
                
                // Add record text
                const recordText = document.createElement('span');
                recordText.classList.add('record-text');
                recordText.textContent = record.record;
                
                // Add label with color coding
                const labelSpan = document.createElement('span');
                labelSpan.classList.add('logic-label');
                labelSpan.textContent = record.label;
                
                // Apply color coding
                switch(record.label) {
                    case "Time In":
                        labelSpan.style.color = "#28a745";
                        break;
                    case "Time Out":
                        labelSpan.style.color = "#dc3545";
                        break;
                    case "Break Out":
                        labelSpan.style.color = "#fd7e14";
                        break;
                    case "Break In":
                        labelSpan.style.color = "#007bff";
                        break;
                }
                
                leftContainer.appendChild(recordText);
                leftContainer.appendChild(labelSpan);
                entry.appendChild(leftContainer);
                recordBox.appendChild(entry);
            });
        } else {
            alert("Error: " + data.message);
        }
    })
    .catch(err => {
        console.error(err);
        alert("Error executing logic.");
    });
}

function showReviewModal(data) {
    const modalOverlay = document.createElement('div');
    modalOverlay.classList.add('modal-overlay');
    
    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');
    
    // Add header
    const header = document.createElement('h3');
    header.textContent = 'Review Schedules';
    modalContent.appendChild(header);

    // Add generic issues notice if any issues exist
    if (data.issues.length > 0) {
        const issuesHeader = document.createElement('h4');
        issuesHeader.textContent = 'Issues found. Please review Schedule.';
        issuesHeader.classList.add('issues-header');
        modalContent.appendChild(issuesHeader);
    }
    
    // Add all schedules for editing
    const schedulesContainer = document.createElement('div');
    schedulesContainer.classList.add('schedules-container');
    
    data.merged_records.forEach(mergedRecord => {
        // Create date header container
        const dateHeaderContainer = document.createElement('div');
        dateHeaderContainer.classList.add('date-header-container');
        
        // Add date header
        const dateHeader = document.createElement('h4');
        dateHeader.textContent = mergedRecord.date;
        dateHeaderContainer.appendChild(dateHeader);
        
        // Add plus button
        const addButton = document.createElement('button');
        addButton.innerHTML = '&#43;'; // Plus symbol
        addButton.classList.add('add-schedule-btn');
        addButton.title = 'Add new schedule';
        addButton.onclick = () => addNewScheduleRow(mergedRecord.date, dateHeaderContainer.nextElementSibling);
        dateHeaderContainer.appendChild(addButton);
        
        schedulesContainer.appendChild(dateHeaderContainer);
        
        // Create records container for this date
        const dateRecordsContainer = document.createElement('div');
        dateRecordsContainer.classList.add('date-records-container');
        
        mergedRecord.records.forEach(record => {
            dateRecordsContainer.appendChild(createRecordRow(record));
        });
        
        schedulesContainer.appendChild(dateRecordsContainer);
    });
    modalContent.appendChild(schedulesContainer);
    
    // Add buttons container
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('modal-buttons');
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = "Save Changes";
    saveBtn.onclick = () => {
        // Collect all records including newly added ones
        const editedRecords = [];
        
        schedulesContainer.querySelectorAll('.date-records-container').forEach(dateContainer => {
            const date = dateContainer.previousElementSibling.querySelector('h4').textContent;
            dateContainer.querySelectorAll('.record-edit-row').forEach(row => {
                const time = row.querySelector('.time-picker').value;
                const label = row.querySelector('select').value;
                
                // Get date parts
                const [day, month, year] = date.split('/');
                
                // Get day of week for the date
                const dateObj = new Date(year, month - 1, day);
                const dayOfWeek = dateObj.toLocaleString('en-US', { weekday: 'long' });
                
                // Format for saving to file - without labels
                const recordEntry = `${dayOfWeek} - ${date} - ${time}`;
                editedRecords.push(recordEntry);
            });
        });

        // Create JSON data and download
        const jsonData = JSON.stringify({ recordedTimes: editedRecords }, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'edited_schedules.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Update the display immediately with edited records
        const schedule = {
            schedule_day: document.getElementById('schedule-day').value || "Monday",
            start_time: document.getElementById('start-time').value || "6:00 AM",
            end_time: document.getElementById('end-time').value || "2:00 PM"
        };

        fetch('/execute_logic3', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordedTimes: editedRecords, schedule })
        })
        .then(response => response.json())
        .then(newData => {
            if (newData.status === "success") {
                const recordBox = document.getElementById('record-box');
                recordBox.innerHTML = '';

                // Add review row if needed
                if (newData.needs_review) {
                    const reviewRow = document.createElement('div');
                    reviewRow.classList.add('review-row');
                    
                    const warningIcon = document.createElement('span');
                    warningIcon.innerHTML = '⚠️';
                    warningIcon.classList.add('warning-icon');
                    
                    const warningText = document.createElement('span');
                    warningText.textContent = 'Marked for Review';
                    warningText.classList.add('warning-text');
                    
                    const reviewBtn = document.createElement('button');
                    reviewBtn.textContent = 'Review';
                    reviewBtn.classList.add('review-btn');
                    reviewBtn.onclick = () => showReviewModal(newData);
                    
                    reviewRow.appendChild(warningIcon);
                    reviewRow.appendChild(warningText);
                    reviewRow.appendChild(reviewBtn);
                    recordBox.appendChild(reviewRow);
                }

                // Display updated records
                newData.original_records.forEach(record => {
                    const entry = document.createElement('div');
                    entry.classList.add('record-entry');
                    
                    const leftContainer = document.createElement('div');
                    leftContainer.classList.add('record-left-container');
                    leftContainer.style.display = 'flex';
                    leftContainer.style.alignItems = 'center';
                    leftContainer.style.gap = '8px';
                    
                    const recordText = document.createElement('span');
                    recordText.classList.add('record-text');
                    recordText.textContent = record.record;
                    
                    const labelSpan = document.createElement('span');
                    labelSpan.classList.add('logic-label');
                    labelSpan.textContent = record.label;
                    
                    switch(record.label) {
                        case "Time In":
                            labelSpan.style.color = "#28a745";
                            break;
                        case "Time Out":
                            labelSpan.style.color = "#dc3545";
                            break;
                        case "Break Out":
                            labelSpan.style.color = "#fd7e14";
                            break;
                        case "Break In":
                            labelSpan.style.color = "#007bff";
                            break;
                    }
                    
                    leftContainer.appendChild(recordText);
                    leftContainer.appendChild(labelSpan);
                    entry.appendChild(leftContainer);
                    recordBox.appendChild(entry);
                });
            }
        })
        .catch(err => {
            console.error(err);
            alert("Error updating display after save.");
        });
        
        document.body.removeChild(modalOverlay);
    };
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => document.body.removeChild(modalOverlay);
    
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(closeBtn);
    modalContent.appendChild(buttonContainer);
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
}

function createRecordRow(record = null) {
    const recordDiv = document.createElement('div');
    recordDiv.classList.add('record-edit-row');
    
    // Create time input with Flatpickr
    const timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.classList.add('time-picker');
    
    // Set the value if record exists
    if (record) {
        const timePart = record.record.split(' - ').pop();
        timeInput.value = timePart;
    }
    
    // Initialize Flatpickr on the time input
    flatpickr(timeInput, {
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K", // 12-hour format with AM/PM
        time_24hr: false
    });
    
    // Create label select
    const labelSelect = document.createElement('select');
    ['Time In', 'Time Out', 'Break In', 'Break Out'].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.text = opt;
        if (record && opt === record.label) {
            option.selected = true;
        }
        labelSelect.appendChild(option);
    });

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '&times;';
    deleteBtn.classList.add('delete-schedule-btn');
    deleteBtn.onclick = () => recordDiv.remove();
    
    // Append elements
    recordDiv.appendChild(timeInput);
    recordDiv.appendChild(labelSelect);
    recordDiv.appendChild(deleteBtn);
    
    return recordDiv;
}

function addNewScheduleRow(date, container) {
    container.appendChild(createRecordRow());
}

document.getElementById('logic3').addEventListener('change', function() {
    const recordBox = document.getElementById('record-box');
    
    if (this.checked) {
        applyLogic3();
    } else {
        // Remove all logic3 additions when unchecked
        const entries = Array.from(recordBox.getElementsByClassName('record-entry'));
        entries.forEach(entry => {
            const leftContainer = entry.querySelector('.record-left-container');
            if (leftContainer) {
                // Create a new div to maintain proper structure
                const newEntry = document.createElement('div');
                newEntry.classList.add('record-entry');
                
                // Create a new div for left container to maintain compatibility with Logic 1
                const newLeftContainer = document.createElement('div');
                newLeftContainer.classList.add('record-left-container');
                newLeftContainer.style.display = 'flex';
                newLeftContainer.style.alignItems = 'center';
                newLeftContainer.style.gap = '8px';
                
                // Create a new span for the record text
                const span = document.createElement('span');
                span.classList.add('record-text'); // Add this class for Logic 1
                const recordText = leftContainer.querySelector('.record-text');
                if (recordText) {
                    span.textContent = recordText.textContent;
                }
                
                newLeftContainer.appendChild(span);
                newEntry.appendChild(newLeftContainer);
                entry.parentNode.replaceChild(newEntry, entry);
            }
        });
        
        // Remove review warning if present
        const reviewRow = recordBox.querySelector('.review-row');
        if (reviewRow) {
            reviewRow.remove();
        }
    }
});