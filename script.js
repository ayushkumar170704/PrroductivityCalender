class ProductivityCalendar {
    constructor() {
        this.currentDate = new Date();
        this.currentView = 'month';
        this.events = JSON.parse(localStorage.getItem('calendarEvents')) || [];
        this.editingEventId = null;
        this.selectedColor = '#667eea';
        
        this.init();
        this.setupEventListeners();
        this.render();
        this.checkReminders();
    }

    init() {
        this.updateCurrentDateDisplay();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('prevBtn').addEventListener('click', () => this.navigateDate(-1));
        document.getElementById('nextBtn').addEventListener('click', () => this.navigateDate(1));
        
        // View switching
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });
        
        // Event management
        document.getElementById('addEventBtn').addEventListener('click', () => this.openEventModal());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportToICS());
        
        // Modal
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeEventModal());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteEvent());
        document.getElementById('eventForm').addEventListener('submit', (e) => this.saveEvent(e));
        
        // Color selection
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectColor(e.target.dataset.color));
        });
        
        // Modal close on outside click
        document.getElementById('eventModal').addEventListener('click', (e) => {
            if (e.target.id === 'eventModal') this.closeEventModal();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeEventModal();
            if (e.key === 'n' && e.ctrlKey) {
                e.preventDefault();
                this.openEventModal();
            }
        });
    }

    navigateDate(direction) {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        } else if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
        } else if (this.currentView === 'day') {
            this.currentDate.setDate(this.currentDate.getDate() + direction);
        }
        this.updateCurrentDateDisplay();
        this.render();
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        document.querySelectorAll('#monthView, #weekView, #dayView').forEach(v => v.style.display = 'none');
        document.getElementById(`${view}View`).style.display = 'block';
        
        this.updateCurrentDateDisplay();
        this.render();
    }

    updateCurrentDateDisplay() {
        const options = { year: 'numeric', month: 'long' };
        if (this.currentView === 'day') {
            options.day = 'numeric';
        } else if (this.currentView === 'week') {
            const weekStart = new Date(this.currentDate);
            weekStart.setDate(this.currentDate.getDate() - this.currentDate.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            document.getElementById('currentDate').textContent = 
                `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            return;
        }
        document.getElementById('currentDate').textContent = this.currentDate.toLocaleDateString('en-US', options);
    }

    render() {
        if (this.currentView === 'month') {
            this.renderMonthView();
        } else if (this.currentView === 'week') {
            this.renderWeekView();
        } else if (this.currentView === 'day') {
            this.renderDayView();
        }
    }

    renderMonthView() {
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const today = new Date();
        
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            if (date.getMonth() !== month) {
                dayElement.classList.add('other-month');
            }
            
            if (date.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }
            
            dayElement.innerHTML = `
                <div class="day-number">${date.getDate()}</div>
                <div class="events-list"></div>
            `;
            
            // Add events
            const dayEvents = this.getEventsForDate(date);
            const eventsList = dayElement.querySelector('.events-list');
            dayEvents.forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'event';
                eventElement.style.setProperty('--category-color', event.color);
                eventElement.textContent = event.title;
                eventElement.title = `${event.title}\n${event.time ? 'Time: ' + event.time : 'All day'}\n${event.description ? 'Description: ' + event.description : ''}`;
                eventElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editEvent(event);
                });
                eventsList.appendChild(eventElement);
            });
            
            dayElement.addEventListener('click', () => {
                this.openEventModal(date);
            });
            
            grid.appendChild(dayElement);
        }
    }

    renderWeekView() {
        const weekGrid = document.getElementById('weekGrid');
        
        // Clear existing content except headers
        const existingContent = weekGrid.querySelectorAll(':not(.week-header)');
        existingContent.forEach(el => el.remove());
        
        // Get week start date
        const weekStart = new Date(this.currentDate);
        weekStart.setDate(this.currentDate.getDate() - this.currentDate.getDay());
        
        // Create time slots and day columns
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.textContent = `${hour.toString().padStart(2, '0')}:00`;
            weekGrid.appendChild(timeSlot);
            
            for (let day = 0; day < 7; day++) {
                const currentDay = new Date(weekStart);
                currentDay.setDate(weekStart.getDate() + day);
                
                const dayColumn = document.createElement('div');
                dayColumn.className = 'week-day-column';
                dayColumn.style.position = 'relative';
                
                // Add events for this hour and day
                const dayEvents = this.getEventsForDate(currentDay);
                dayEvents.forEach(event => {
                    if (event.time) {
                        const eventHour = parseInt(event.time.split(':')[0]);
                        if (eventHour === hour) {
                            const eventElement = document.createElement('div');
                            eventElement.style.cssText = `
                                position: absolute;
                                top: 5px;
                                left: 5px;
                                right: 5px;
                                background: ${event.color};
                                color: white;
                                padding: 5px;
                                border-radius: 5px;
                                font-size: 11px;
                                cursor: pointer;
                                z-index: 1;
                            `;
                            eventElement.textContent = event.title;
                            eventElement.addEventListener('click', () => this.editEvent(event));
                            dayColumn.appendChild(eventElement);
                        }
                    }
                });
                
                dayColumn.addEventListener('click', () => {
                    const clickDate = new Date(weekStart);
                    clickDate.setDate(weekStart.getDate() + day);
                    this.openEventModal(clickDate);
                });
                
                weekGrid.appendChild(dayColumn);
            }
        }
    }

    renderDayView() {
        const dayHeader = document.getElementById('dayHeader');
        const dayContent = document.getElementById('dayContent');
        
        dayHeader.textContent = this.currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        dayContent.innerHTML = '';
        
        const dayEvents = this.getEventsForDate(this.currentDate);
        
        if (dayEvents.length === 0) {
            dayContent.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No events scheduled for this day</p>';
        } else {
            dayEvents.forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.style.cssText = `
                    background: ${event.color};
                    color: white;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                `;
                eventElement.addEventListener('mouseenter', () => {
                    eventElement.style.transform = 'scale(1.02)';
                });
                eventElement.addEventListener('mouseleave', () => {
                    eventElement.style.transform = 'scale(1)';
                });
                eventElement.addEventListener('click', () => this.editEvent(event));
                
                eventElement.innerHTML = `
                    <h3 style="margin: 0 0 5px 0;">${event.title}</h3>
                    ${event.time ? `<p style="margin: 0 0 5px 0;"><strong>Time:</strong> ${event.time}</p>` : ''}
                    ${event.description ? `<p style="margin: 0;">${event.description}</p>` : ''}
                `;
                
                dayContent.appendChild(eventElement);
            });
        }
        
        // Add click to create event
        dayContent.addEventListener('click', (e) => {
            if (e.target === dayContent) {
                this.openEventModal(this.currentDate);
            }
        });
    }

    getEventsForDate(date) {
        const dateString = date.toISOString().split('T')[0];
        return this.events.filter(event => event.date === dateString);
    }

    openEventModal(selectedDate = null) {
        const modal = document.getElementById('eventModal');
        const modalTitle = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deleteBtn');
        
        this.editingEventId = null;
        modalTitle.textContent = 'Add New Event';
        deleteBtn.style.display = 'none';
        
        // Reset form
        document.getElementById('eventForm').reset();
        this.selectedColor = '#667eea';
        this.updateColorSelection();
        
        if (selectedDate) {
            document.getElementById('eventDate').value = selectedDate.toISOString().split('T')[0];
        } else {
            document.getElementById('eventDate').value = new Date().toISOString().split('T')[0];
        }
        
        modal.classList.add('active');
        document.getElementById('eventTitle').focus();
    }

    closeEventModal() {
        const modal = document.getElementById('eventModal');
        modal.classList.remove('active');
    }

    editEvent(event) {
        const modal = document.getElementById('eventModal');
        const modalTitle = document.getElementById('modalTitle');
        const deleteBtn = document.getElementById('deleteBtn');
        
        this.editingEventId = event.id;
        modalTitle.textContent = 'Edit Event';
        deleteBtn.style.display = 'block';
        
        // Fill form with event data
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventReminder').value = event.reminder || '0';
        
        this.selectedColor = event.color;
        this.updateColorSelection();
        
        modal.classList.add('active');
        document.getElementById('eventTitle').focus();
    }

    saveEvent(e) {
        e.preventDefault();
        
        const title = document.getElementById('eventTitle').value.trim();
        const date = document.getElementById('eventDate').value;
        const time = document.getElementById('eventTime').value;
        const description = document.getElementById('eventDescription').value.trim();
        const reminder = parseInt(document.getElementById('eventReminder').value);
        
        if (!title || !date) {
            this.showNotification('Please fill in required fields', 'error');
            return;
        }
        
        const eventData = {
            id: this.editingEventId || Date.now().toString(),
            title,
            date,
            time,
            description,
            reminder,
            color: this.selectedColor
        };
        
        if (this.editingEventId) {
            // Update existing event
            const eventIndex = this.events.findIndex(event => event.id === this.editingEventId);
            if (eventIndex !== -1) {
                this.events[eventIndex] = eventData;
                this.showNotification('Event updated successfully!', 'success');
            }
        } else {
            // Add new event
            this.events.push(eventData);
            this.showNotification('Event added successfully!', 'success');
        }
        
        this.saveToStorage();
        this.closeEventModal();
        this.render();
    }

    deleteEvent() {
        if (this.editingEventId) {
            if (confirm('Are you sure you want to delete this event?')) {
                this.events = this.events.filter(event => event.id !== this.editingEventId);
                this.saveToStorage();
                this.closeEventModal();
                this.render();
                this.showNotification('Event deleted successfully!', 'success');
            }
        }
    }

    selectColor(color) {
        this.selectedColor = color;
        this.updateColorSelection();
    }

    updateColorSelection() {
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.color === this.selectedColor) {
                option.classList.add('selected');
            }
        });
    }

    saveToStorage() {
        localStorage.setItem('calendarEvents', JSON.stringify(this.events));
    }

    checkReminders() {
        const now = new Date();
        
        this.events.forEach(event => {
            if (event.reminder > 0) {
                const eventDateTime = new Date(`${event.date}T${event.time || '00:00'}`);
                const reminderTime = new Date(eventDateTime.getTime() - (event.reminder * 60 * 1000));
                
                if (now >= reminderTime && now < eventDateTime) {
                    // Check if we've already shown this reminder
                    const reminderKey = `reminder_${event.id}_${event.date}`;
                    if (!localStorage.getItem(reminderKey)) {
                        this.showNotification(`Reminder: ${event.title} in ${event.reminder} minutes`, 'reminder');
                        localStorage.setItem(reminderKey, 'shown');
                    }
                }
            }
        });
        
        // Check reminders every minute
        setTimeout(() => this.checkReminders(), 60000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
        } else if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #43e97b, #38c172)';
        } else if (type === 'reminder') {
            notification.style.background = 'linear-gradient(135deg, #ffecd2, #fcb69f)';
            notification.style.color = '#333';
        }
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    exportToICS() {
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Productivity Calendar//EN',
            'CALSCALE:GREGORIAN'
        ];
        
        this.events.forEach(event => {
            const eventDate = new Date(`${event.date}T${event.time || '00:00'}`);
            const dtstart = this.formatDateForICS(eventDate);
            const dtend = this.formatDateForICS(new Date(eventDate.getTime() + 3600000)); // Add 1 hour
            
            icsContent.push(
                'BEGIN:VEVENT',
                `DTSTART:${dtstart}`,
                `DTEND:${dtend}`,
                `SUMMARY:${event.title}`,
                `DESCRIPTION:${event.description || ''}`,
                `UID:${event.id}@productivitycalendar.com`,
                'END:VEVENT'
            );
        });
        
        icsContent.push('END:VCALENDAR');
        
        const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'productivity_calendar.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showNotification('Calendar exported successfully!', 'success');
    }

    formatDateForICS(date) {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProductivityCalendar();
});