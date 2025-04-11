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
    const scheduleItems = Array.from(scheduleList.querySelector('table tbody').getElementsByTagName('tr')).map(row => {
        const cells = row.getElementsByTagName('td');
        if (cells.length >= 4) {
            return {
                start_day: cells[0].textContent.trim(),
                start_time: cells[1].textContent.trim(),
                end_day: cells[2].textContent.trim(),
                end_time: cells[3].textContent.trim()
            };
        }
        return null;
    }).filter(item => item !== null);

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
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100%';
    modalOverlay.style.height = '100%';
    modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '1000';
    
    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.borderRadius = '8px';
    modalContent.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    modalContent.style.width = '80%';
    modalContent.style.maxWidth = '800px';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflow = 'auto';
    modalContent.style.padding = '24px';
    
    // Add header with improved styling
    const header = document.createElement('h3');
    header.textContent = 'Review Schedules';
    header.style.color = '#333';
    header.style.borderBottom = '2px solid #f0f0f0';
    header.style.paddingBottom = '12px';
    header.style.marginTop = '0';
    modalContent.appendChild(header);

    // Add generic issues notice if any issues exist
    if (data.issues.length > 0) {
        const issuesContainer = document.createElement('div');
        issuesContainer.style.backgroundColor = '#fff3cd';
        issuesContainer.style.border = '1px solid #ffeeba';
        issuesContainer.style.borderRadius = '4px';
        issuesContainer.style.padding = '12px';
        issuesContainer.style.marginBottom = '16px';
        
        const issuesHeader = document.createElement('h4');
        issuesHeader.textContent = 'Issues found. Please review Schedule.';
        issuesHeader.classList.add('issues-header');
        issuesHeader.style.margin = '0';
        issuesHeader.style.color = '#856404';
        issuesContainer.appendChild(issuesHeader);
        
        // Remove the issue list section and just show the header warning
        modalContent.appendChild(issuesContainer);
    }
    
    // Add all schedules for editing with improved styling
    const schedulesContainer = document.createElement('div');
    schedulesContainer.classList.add('schedules-container');
    schedulesContainer.style.marginTop = '16px';
    
    data.merged_records.forEach(mergedRecord => {
        // Create date header container
        const dateHeaderContainer = document.createElement('div');
        dateHeaderContainer.classList.add('date-header-container');
        dateHeaderContainer.style.display = 'flex';
        dateHeaderContainer.style.justifyContent = 'space-between';
        dateHeaderContainer.style.alignItems = 'center';
        dateHeaderContainer.style.padding = '8px 0';
        dateHeaderContainer.style.marginTop = '16px';
        dateHeaderContainer.style.marginBottom = '8px';
        dateHeaderContainer.style.borderBottom = '1px solid #e0e0e0';
        
        // Add date header
        const dateHeader = document.createElement('h4');
        dateHeader.textContent = `${mergedRecord.day}, ${mergedRecord.date}`;
        dateHeader.style.margin = '0';
        dateHeader.style.color = '#495057';
        dateHeaderContainer.appendChild(dateHeader);
        
        // Add plus button with improved styling
        const addButton = document.createElement('button');
        addButton.innerHTML = '&#43;'; // Plus symbol
        addButton.classList.add('add-schedule-btn');
        addButton.title = 'Add new schedule';
        addButton.style.width = '32px';
        addButton.style.height = '32px';
        addButton.style.borderRadius = '50%';
        addButton.style.border = 'none';
        addButton.style.backgroundColor = '#28a745';
        addButton.style.color = 'white';
        addButton.style.fontSize = '18px';
        addButton.style.display = 'flex';
        addButton.style.alignItems = 'center';
        addButton.style.justifyContent = 'center';
        addButton.style.cursor = 'pointer';
        addButton.style.transition = 'all 0.2s ease';
        addButton.onclick = () => addNewScheduleRow(mergedRecord.date, dateHeaderContainer.nextElementSibling);
        
        // Add hover effect
        addButton.onmouseover = () => {
            addButton.style.backgroundColor = '#218838';
        };
        addButton.onmouseout = () => {
            addButton.style.backgroundColor = '#28a745';
        };
        
        dateHeaderContainer.appendChild(addButton);
        schedulesContainer.appendChild(dateHeaderContainer);
        
        // Create records container for this date
        const dateRecordsContainer = document.createElement('div');
        dateRecordsContainer.classList.add('date-records-container');
        dateRecordsContainer.style.paddingLeft = '8px';
        
        mergedRecord.records.forEach(record => {
            dateRecordsContainer.appendChild(createRecordRow(record));
        });
        
        schedulesContainer.appendChild(dateRecordsContainer);
    });
    modalContent.appendChild(schedulesContainer);
    
    // Add buttons container with improved styling
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('modal-buttons');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '12px';
    buttonContainer.style.marginTop = '24px';
    buttonContainer.style.paddingTop = '16px';
    buttonContainer.style.borderTop = '1px solid #e0e0e0';
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = "Save Changes";
    saveBtn.style.padding = '10px 20px';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.border = 'none';
    saveBtn.style.backgroundColor = '#007bff';
    saveBtn.style.color = 'white';
    saveBtn.style.fontSize = '14px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.transition = 'all 0.2s ease';
    
    // Add hover effect
    saveBtn.onmouseover = () => {
        saveBtn.style.backgroundColor = '#0069d9';
    };
    saveBtn.onmouseout = () => {
        saveBtn.style.backgroundColor = '#007bff';
    };
    
    saveBtn.onclick = () => {
        // Create a collection of time records with their selected labels
        const editedRecords = [];
        const labeledRecords = [];
        
        // Extract timestamp data and selected labels from the modal
        schedulesContainer.querySelectorAll('.date-records-container').forEach(dateContainer => {
            const dateHeader = dateContainer.previousElementSibling.querySelector('h4').textContent;
            dateContainer.querySelectorAll('.record-edit-row').forEach(row => {
                // Get the time value from the time picker
                const timeInput = row.querySelector('.time-picker');
                if (!timeInput || !timeInput.value) return;
                
                // Get the selected label from the dropdown
                const labelDropdown = row.querySelector('select');
                if (!labelDropdown) return;
                
                // NEW: Get the validated overtime checkbox value if present
                const validateCheckbox = row.querySelector('.validate-overtime');
                const isValidated = validateCheckbox ? validateCheckbox.checked : false;
                
                const time = timeInput.value.trim();
                const selectedLabel = labelDropdown.value;
                
                // Parse the date header to get day and date
                const headerParts = dateHeader.split(', ');
                if (headerParts.length !== 2) return;
                
                const day = headerParts[0].trim();
                const dateStr = headerParts[1].trim();
                
                // Create properly formatted record string: "Day - DD/MM/YYYY - HH:MM AM/PM"
                const recordEntry = `${day} - ${dateStr} - ${time}`;
                
                // Validate format before adding
                if (recordEntry.match(/^\w+ - \d{2}\/\d{2}\/\d{4} - \d{1,2}:\d{2} [AP]M$/)) {
                    editedRecords.push(recordEntry);
                    // Also track the label and validation state
                    labeledRecords.push({
                        record: recordEntry,
                        label: selectedLabel,
                        validated_overtime: isValidated // Add the validation state
                    });
                }
            });
        });

        // Get schedules from the UI
        const scheduleList = document.getElementById('schedule-list');
        const scheduleItems = Array.from(scheduleList.querySelector('table tbody').getElementsByTagName('tr')).map(row => {
            const cells = row.getElementsByTagName('td');
            if (cells.length >= 4) {
                return {
                    start_day: cells[0].textContent.trim(),
                    start_time: cells[1].textContent.trim(),
                    end_day: cells[2].textContent.trim(),
                    end_time: cells[3].textContent.trim()
                };
            }
            return null;
        }).filter(item => item !== null);

        // Send the updated records to the backend
        const payload = {
            recordedTimes: labeledRecords, // Send the records with validation state
            schedules: {
                schedules: scheduleItems
            }
        };

        fetch('/execute_logic3', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(newData => {
            if (newData.status === "success") {
                // If user-provided labels exist in the response, use them
                if (labeledRecords.length > 0) {
                    // Create a map for quick lookup of labels by record
                    const labelMap = {};
                    labeledRecords.forEach(item => {
                        labelMap[item.record] = item.label;
                    });
                    
                    // Apply user-selected labels to the records
                    if (newData.original_records) {
                        newData.original_records.forEach(record => {
                            if (labelMap[record.record]) {
                                record.label = labelMap[record.record];
                            }
                        });
                    }
                }
                
                // Update the UI based on the modified response
                updateUIWithRecords(newData);
                
                // Replace the alert with our new success modal
                showSuccessModal();
            } else {
                alert(newData.message || "Error processing records");
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
    closeBtn.style.padding = '10px 20px';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.border = '1px solid #6c757d';
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.color = '#6c757d';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.transition = 'all 0.2s ease';
    
    // Add hover effect
    closeBtn.onmouseover = () => {
        closeBtn.style.backgroundColor = '#f8f9fa';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.backgroundColor = 'transparent';
    };
    
    closeBtn.onclick = () => document.body.removeChild(modalOverlay);
    
    buttonContainer.appendChild(closeBtn);
    buttonContainer.appendChild(saveBtn);
    modalContent.appendChild(buttonContainer);
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
}

// Add this function to show a success modal
function showSuccessModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.classList.add('modal-overlay');
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100%';
    modalOverlay.style.height = '100%';
    modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '1000';
    
    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.borderRadius = '8px';
    modalContent.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    modalContent.style.width = '320px';
    modalContent.style.padding = '24px';
    modalContent.style.textAlign = 'center';
    
    // Container for the thumbs up image
    const imageContainer = document.createElement('div');
    imageContainer.style.marginBottom = '16px';
    
    // Add the thumbs up image - use the path to your PNG file
    const thumbsUpImg = document.createElement('img');
    thumbsUpImg.src = '/static/images/thumbs-up.jpg'; // Update this path to your actual image
    thumbsUpImg.alt = 'Thumbs Up';
    thumbsUpImg.style.width = '64px';
    thumbsUpImg.style.height = '64px';
    
    imageContainer.appendChild(thumbsUpImg);
    modalContent.appendChild(imageContainer);
    
    // Success message
    const messageText = document.createElement('h3');
    messageText.textContent = 'Changes Saved Successfully!';
    messageText.style.color = '#28a745';
    messageText.style.marginBottom = '24px';
    modalContent.appendChild(messageText);
    
    // OK button
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.padding = '8px 24px';
    okButton.style.borderRadius = '4px';
    okButton.style.border = 'none';
    okButton.style.backgroundColor = '#28a745';
    okButton.style.color = 'white';
    okButton.style.fontSize = '16px';
    okButton.style.cursor = 'pointer';
    okButton.style.transition = 'background-color 0.2s';
    
    okButton.onmouseover = () => {
        okButton.style.backgroundColor = '#218838';
    };
    
    okButton.onmouseout = () => {
        okButton.style.backgroundColor = '#28a745';
    };
    
    okButton.onclick = () => {
        document.body.removeChild(modalOverlay);
    };
    
    modalContent.appendChild(okButton);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
        if (document.body.contains(modalOverlay)) {
            document.body.removeChild(modalOverlay);
        }
    }, 3000);
}

// Helper function to update UI with processed records
function updateUIWithRecords(data) {
    const recordBox = document.getElementById('record-box');
    recordBox.innerHTML = '';

    // Add review row ONLY if backend indicates needs_review
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

    // Display updated records
    data.original_records.forEach(record => {
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
        
        // Add a "✓" checkmark symbol to validated overtime records
        if (record.validated_overtime && 
           (record.label === "Time Out (Overtime)" || record.label === "Time Out")) {
            labelSpan.textContent += " ✓";
            labelSpan.title = "Validated Overtime";
            labelSpan.style.fontStyle = "italic";
        }
        
        switch(record.label) {
            case "Time In":
            case "Time In (Early)":
                labelSpan.style.color = "#28a745";
                break;
            case "Time In (Late)":
                labelSpan.style.color = "#ffc107"; // amber/yellow for late arrivals
                break;
            case "Time Out":
            case "Time Out (Overtime)":
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

function createRecordRow(record) {
    const row = document.createElement('div');
    row.classList.add('record-edit-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.margin = '8px 0';
    row.style.padding = '10px';
    row.style.borderRadius = '6px';
    row.style.backgroundColor = '#f8f9fa';
    row.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    row.style.transition = 'all 0.2s ease';

    // Time input with better styling - replaced with flatpickr
    const timeInput = document.createElement('input');
    timeInput.classList.add('time-picker');
    timeInput.type = 'text';
    timeInput.value = record ? record.record.split(' - ')[2] : ''; // Extract time part
    timeInput.style.padding = '8px 12px';
    timeInput.style.borderRadius = '4px';
    timeInput.style.border = '1px solid #ced4da';
    timeInput.style.fontSize = '14px';
    timeInput.style.marginRight = '10px';
    timeInput.style.width = '100px';
    timeInput.style.cursor = 'pointer';
    timeInput.style.backgroundColor = '#fff';
    row.appendChild(timeInput);
    
    // Initialize flatpickr on the time input field
    flatpickr(timeInput, {
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K", // Format: 1:30 PM
        time_24hr: false,
        disableMobile: true, // Ensures consistent experience across devices
        minuteIncrement: 1
    });

    // Label dropdown with improved styling
    const labelContainer = document.createElement('div');
    labelContainer.style.position = 'relative';
    labelContainer.style.flex = '1';
    
    const labelDropdown = document.createElement('select');
    labelDropdown.style.width = '100%';
    labelDropdown.style.padding = '8px 12px';
    labelDropdown.style.borderRadius = '4px';
    labelDropdown.style.border = '1px solid #ced4da';
    labelDropdown.style.backgroundColor = '#fff';
    labelDropdown.style.fontSize = '14px';
    labelDropdown.style.appearance = 'none';
    labelDropdown.style.cursor = 'pointer';
    
    // Group options by type for better organization
    const timeInOptGroup = document.createElement('optgroup');
    timeInOptGroup.label = 'Time In Options';
    
    const timeInOpt = document.createElement('option');
    timeInOpt.value = "Time In";
    timeInOpt.textContent = "Time In";
    timeInOpt.style.color = "#28a745";
    
    const timeInEarlyOpt = document.createElement('option');
    timeInEarlyOpt.value = "Time In (Early)";
    timeInEarlyOpt.textContent = "Time In (Early)";
    timeInEarlyOpt.style.color = "#28a745";
    timeInEarlyOpt.style.fontStyle = "italic";
    
    const timeInLateOpt = document.createElement('option');
    timeInLateOpt.value = "Time In (Late)";
    timeInLateOpt.textContent = "Time In (Late)";
    timeInLateOpt.style.color = "#ffc107";
    timeInLateOpt.style.fontStyle = "italic";
    
    timeInOptGroup.appendChild(timeInOpt);
    timeInOptGroup.appendChild(timeInEarlyOpt);
    timeInOptGroup.appendChild(timeInLateOpt); // Add the new option
    labelDropdown.appendChild(timeInOptGroup);
    
    const timeOutOptGroup = document.createElement('optgroup');
    timeOutOptGroup.label = 'Time Out Options';
    
    const timeOutOpt = document.createElement('option');
    timeOutOpt.value = "Time Out";
    timeOutOpt.textContent = "Time Out";
    timeOutOpt.style.color = "#dc3545";
    
    const timeOutOvertimeOpt = document.createElement('option');
    timeOutOvertimeOpt.value = "Time Out (Overtime)";
    timeOutOvertimeOpt.textContent = "Time Out (Overtime)";
    timeOutOvertimeOpt.style.color = "#dc3545";
    timeOutOvertimeOpt.style.fontStyle = "italic";
    
    timeOutOptGroup.appendChild(timeOutOpt);
    timeOutOptGroup.appendChild(timeOutOvertimeOpt);
    labelDropdown.appendChild(timeOutOptGroup);
    
    const breakOptGroup = document.createElement('optgroup');
    breakOptGroup.label = 'Break Options';
    
    const breakOutOpt = document.createElement('option');
    breakOutOpt.value = "Break Out";
    breakOutOpt.textContent = "Break Out";
    breakOutOpt.style.color = "#fd7e14";
    
    const breakInOpt = document.createElement('option');
    breakInOpt.value = "Break In";
    breakInOpt.textContent = "Break In";
    breakInOpt.style.color = "#007bff";
    
    breakOptGroup.appendChild(breakOutOpt);
    breakOptGroup.appendChild(breakInOpt);
    labelDropdown.appendChild(breakOptGroup);
    
    // Set selected option if record exists
    if (record) {
        for (let i = 0; i < labelDropdown.options.length; i++) {
            if (labelDropdown.options[i].value === record.label) {
                labelDropdown.options[i].selected = true;
                break;
            }
        }
    }
    
    // Add dropdown arrow indicator
    const dropdownArrow = document.createElement('div');
    dropdownArrow.innerHTML = '&#9662;'; // Down triangle symbol
    dropdownArrow.style.position = 'absolute';
    dropdownArrow.style.right = '10px';
    dropdownArrow.style.top = '50%';
    dropdownArrow.style.transform = 'translateY(-50%)';
    dropdownArrow.style.pointerEvents = 'none';
    dropdownArrow.style.color = '#6c757d';
    
    labelContainer.appendChild(labelDropdown);
    labelContainer.appendChild(dropdownArrow);
    row.appendChild(labelContainer);

    // Add the validate overtime checkbox for Time Out records that have overtime
    if (record && (record.label === "Time Out (Overtime)" || 
                  (record.label === "Time Out" && record.record.includes("Overtime")))) {
        const validationContainer = document.createElement('div');
        validationContainer.style.marginLeft = '10px';
        validationContainer.style.display = 'flex';
        validationContainer.style.alignItems = 'center';
        
        const validateCheckbox = document.createElement('input');
        validateCheckbox.type = 'checkbox';
        validateCheckbox.className = 'validate-overtime';
        validateCheckbox.checked = record.validated_overtime || false;
        validateCheckbox.id = `validate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const validateLabel = document.createElement('label');
        validateLabel.htmlFor = validateCheckbox.id;
        validateLabel.textContent = 'Validate Overtime';
        validateLabel.style.marginLeft = '5px';
        validateLabel.style.fontSize = '12px';
        validateLabel.style.color = '#6c757d';
        
        validationContainer.appendChild(validateCheckbox);
        validationContainer.appendChild(validateLabel);
        row.appendChild(validationContainer);
    }

    // Delete button with improved styling
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '×';
    deleteButton.classList.add('delete-record-btn');
    deleteButton.style.width = '32px';
    deleteButton.style.height = '32px';
    deleteButton.style.borderRadius = '50%';
    deleteButton.style.border = 'none';
    deleteButton.style.backgroundColor = '#dc3545';
    deleteButton.style.color = 'white';
    deleteButton.style.fontSize = '18px';
    deleteButton.style.display = 'flex';
    deleteButton.style.alignItems = 'center';
    deleteButton.style.justifyContent = 'center';
    deleteButton.style.marginLeft = '10px';
    deleteButton.style.cursor = 'pointer';
    deleteButton.style.transition = 'all 0.2s ease';
    deleteButton.onclick = () => row.remove();
    
    // Add hover effect
    deleteButton.onmouseover = () => {
        deleteButton.style.backgroundColor = '#c82333';
    };
    deleteButton.onmouseout = () => {
        deleteButton.style.backgroundColor = '#dc3545';
    };
    
    row.appendChild(deleteButton);

    return row;
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