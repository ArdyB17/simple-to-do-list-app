/**
 * Application State Management
 * ---------------------------
 * This section defines the core data structures that manage the application's state.
 * We use localStorage to persist data between page reloads.
 */

/**
 * Main Tasks Object Structure:
 * {
 *   todo: Array<Task>,    // Tasks in "To Do" state
 *   doing: Array<Task>,   // Tasks in "Doing" state
 *   done: Array<Task>     // Completed tasks
 * }
 *
 * Task Object Structure:
 * {
 *   id: string,          // Unique identifier
 *   content: string,     // Task description
 *   tags: Array<string>, // Categories/labels
 *   board: string,       // Current board location
 *   createdAt: string    // ISO timestamp
 * }
 */
let tasks = JSON.parse(localStorage.getItem("tasks")) || {
  todo: [],
  doing: [],
  done: [],
};

/**
 * Additional State Management
 * taskOrigins: Keeps track of where tasks were originally before being moved to 'done'
 * selectedTags: Array to store currently selected tags for new tasks
 * isDarkMode: Boolean to track the current theme state
 */
let taskOrigins = JSON.parse(localStorage.getItem("taskOrigins")) || {};
let selectedTags = [];
let isDarkMode = false;

/**
 * DOM Element References
 * --------------------
 * Caching frequently used DOM elements improves performance by avoiding
 * repeated querySelector calls. These elements are used throughout the application
 * for user interaction and UI updates.
 */
const taskInput = document.getElementById("task-input");
const addTaskButton = document.getElementById("add-task");
const searchInput = document.getElementById("search-input");
const themeToggle = document.getElementById("theme-toggle");
const moonIcon = document.getElementById("moon-icon");
const sunIcon = document.getElementById("sun-icon");
const tagsContainer = document.getElementById("tags-container");
const boards = document.querySelectorAll(".board");

/**
 * Data Persistence
 * ---------------
 * Saves the current state to localStorage whenever tasks are modified.
 * This ensures that user data persists between page reloads.
 */
function saveTasks() {
  // Convert tasks array to JSON string and save to localStorage
  localStorage.setItem("tasks", JSON.stringify(tasks));
  // Convert taskOrigins array to JSON string and save to localStorage
  localStorage.setItem("taskOrigins", JSON.stringify(taskOrigins));
}

/**
 * Generates a unique identifier for new tasks
 * Uses timestamp to ensure uniqueness
 * @returns {string}Unique identifier
 */
function generateId() {
  return Date.now().toString();
}

/**
 * Task Management Functions
 * -----------------------
 * Core functions for handling task lifecycle:
 * - Creation
 * - Movement between boards
 * - Deletion
 * - Filtering
 */

/**
 * Creates a new task DOM element with all necessary event listeners
 * @param {Object} task - Task object containing id, content, tags, etc.
 * @param {string} boardId - ID of the board where the task belongs
 * @returns {HTMLElement|null} The created task element or null if invalid input
 *
 * Important Features:
 * 1. Drag and drop functionality
 * 2. Checkbox for completion
 * 3. Delete button
 * 4. Tag display
 */

function createTaskElement(task, boardId) {
  if (!task || !task.id) return null; // Add null check

  // Create a new task element with specified properties
  const taskElement = document.createElement("div");
  // Add 'task' class for styling
  taskElement.className = "task";
  // Enable drag functionality for task cards
  taskElement.draggable = true;
  // Store task ID as data attribute
  taskElement.dataset.id = task.id;
  // Store original board location
  taskElement.dataset.originalBoard = task.originalBoard || boardId;

  // Check if task is in 'done' board
  const isDone = boardId === "done";
  // Add glass effect styling
  taskElement.classList.add("glass-effect");

  // HTML content for task card with dynamic data
  taskElement.innerHTML = `
          <!-- Main container for task header -->
          <div class="task-header">
            <div class="task-header-content">
  
              <!-- Checkbox input: Uses ternary operator to set checked attribute based on isDone -->
              <input type="checkbox" class="task-checkbox" ${
                isDone ? "checked" : ""
              }>
  
              <!-- Task content container: Adds 'completed' class if isDone is true -->
              <div class="task-content ${isDone ? "completed" : ""}">
                ${task.content}  <!-- Displays the actual task text -->
              </div>
  
            </div>
  
            <!-- Delete button container -->
            <button class="delete-button">
              <i class="fas fa-trash"></i>  <!-- Font Awesome trash icon -->
            </button>
            
          </div>
          
          <!-- Container for task tags -->
          <div class="task-tags">
            <!-- Creates tag elements for each tag in the task.tags array -->
            ${task.tags
              .map(
                // Maps through each tag
                (tag) => `
              <span class="task-tag">
                <i class="fas fa-tag"></i>${tag}  <!-- Tag icon and text -->
              </span>
            `
              )
              .join("")}  <!-- Joins all tag elements into a single string -->
          </div>
      `;

  // =========================================================//
  // Add event listeners for checkbox, drag, and delete button||
  // =========================================================//

  // Set up checkbox event listener to handle task completion
  const checkBox = taskElement.querySelector(".task-checkbox");
  checkBox.addEventListener("change", () => {
    if (checkBox.checked) {
      // When task is checked (completed)
      // Store the original board location if not already saved
      if (!taskOrigins[task.id]) {
        taskOrigins[task.id] = boardId;
      }
      // Move the task to the "done" board
      moveTaskToBoard(task.id, "done");
    } else {
      // When task is unchecked (incomplete)
      // Get the original board or default to "todo" if original location unknown
      const originalBoard = taskOrigins[task.id] || "todo";
      // Move task back to its original board
      moveTaskToBoard(task.id, originalBoard);
      // Remove the stored original location since it's no longer needed
      delete taskOrigins[task.id];
    }
  });

  // Enable drag-and-drop functionality for the task
  taskElement.addEventListener("dragstart", (e) =>
    // When starting to drag, store task info and source board
    handleDragStart(e, task, boardId)
  );
  taskElement.addEventListener("dragend", handleDragEnd);

  // Set up delete button functionality
  const deleteButton = taskElement.querySelector(".delete-button");
  deleteButton.addEventListener("click", () => {
    // Only attempt to delete if task has valid ID
    if (task.id) {
      deleteTask(task.id);
    }
  });

  return taskElement;
}

/**
 * Moves a task from one board to another
 * @param {string} taskId - ID of the task to move
 * @param {string} targetBoard - Destination board ID
 */
function moveTaskToBoard(taskId, targetBoard) {
  // Safety check: Don't proceed if no task ID is provided
  if (!taskId) return;

  // Variables to store the task we want to move and its current location
  let task = null;
  let sourceBoard = null;

  // Look through all boards (todo, doing, done) to find our task
  Object.keys(tasks).forEach((board) => {
    // Find where in the current board our task is located
    const taskIndex = tasks[board].findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      // We found the task! Make a copy and remember where we found it
      task = { ...tasks[board][taskIndex] };
      sourceBoard = board;
      // Remove the task from its current location
      tasks[board].splice(taskIndex, 1);
    }
  });

  // If we didn't find the task anywhere, stop here
  if (!task) return;

  // Update the task's board property to show its new location
  task.board = targetBoard;

  // Special handling when moving a task to the "done" board
  if (targetBoard === "done") {
    // Mark the task as completed
    task.completed = true;
    // Remember where this task came from (if we haven't already)
    if (!taskOrigins[taskId]) {
      taskOrigins[taskId] = sourceBoard;
    }
  } else {
    // The task is not in "done", so mark it as not completed
    task.completed = false;
    // If we're moving from "done" to another board, forget its origin
    if (sourceBoard === "done") {
      delete taskOrigins[taskId];
    }
  }

  // Add the task to its new board
  tasks[targetBoard].push(task);
  // Save all changes to localStorage
  saveTasks();
  // Update what the user sees on screen
  renderTasks();
}

/**
 * Creates and adds a new task to the todo board
 * Collects input values and selected tags
 * Generates unique ID and saves the task
 */
function addTask() {
  // Get the task text and remove whitespace from both ends
  const content = taskInput.value.trim();
  // If content is empty, exit the function early
  if (!content) return;

  // Create a new task object with all necessary properties
  const task = {
    id: generateId(), // Create unique ID using timestamp
    content, // The task text content
    tags: [...selectedTags], // Copy selected tags array
    board: "todo", // Initial board is always "todo"
    createdAt: new Date().toISOString(), // Current timestamp in ISO format
  };

  // Add the new task to the todo board's task array
  tasks.todo.push(task);
  // Save all tasks to localStorage
  saveTasks();
  // Update the visual display of all tasks
  renderTasks();

  // Reset the input field to empty
  taskInput.value = "";
  // Clear the selected tags array
  selectedTags = [];
  // Update the visual display of tags
  renderTags();
}


/**
 * Removes a task from all boards and cleans up related data
 * @param {string} taskId - ID of the task to delete
 */
function deleteTask(taskId) {
  // Exit early if no taskId is provided
  if (!taskId) return;

  try {
    // Loop through each board in the tasks object
    Object.keys(tasks).forEach((board) => {
      // Store initial number of tasks for comparison
      const initialLength = tasks[board].length;

      // Remove the task with matching ID from current board
      tasks[board] = tasks[board].filter((task) => task.id !== taskId);

      // Log success message if a task was actually removed
      if (tasks[board].length < initialLength) {
        console.log(`Task ${taskId} deleted from ${board}`);
      }
    });

    // Remove task origin data for this task
    delete taskOrigins[taskId];

    // Persist changes to localStorage
    saveTasks();

    // Update the UI to reflect changes
    renderTasks();
  } catch (error) {
    // Log any errors that occur during deletion
    console.error("Error deleting task:", error);
  }
}

/**
 * Filters tasks based on search input
 * Matches against task content and tags
 * @param {Array} taskList - Array of tasks to filter
 * @returns {Array} Filtered array of tasks
 */
function filterTasks(taskList) {
  const searchQuery = searchInput.value.toLowerCase();
  if (!searchQuery) return taskList;

  return taskList.filter(
    (task) =>
      task.content.toLowerCase().includes(searchQuery) ||
      task.tags.some((tag) => tag.toLowerCase().includes(searchQuery))
  );
}

/**
 * Updates the visual representation of all tasks
 * Filters and renders tasks for each board
 */
function renderTasks() {
  boards.forEach((board) => {
    const boardId = board.dataset.board;
    const tasksContainer = board.querySelector(".tasks-container");
    if (!tasksContainer) return;

    tasksContainer.innerHTML = "";
    const boardTasks = tasks[boardId] || [];

    filterTasks(boardTasks).forEach((task) => {
      const taskElement = createTaskElement(task, boardId);
      if (taskElement) {
        tasksContainer.appendChild(taskElement);
      }
    });
  });
}

/**
 * Drag and Drop State Variables
 * Tracks currently dragged task and its source board
 */
let draggedTask = null;
let sourceBoard = null;

/**
 * Drag and Drop Event Flow:
 * 1. dragstart - Initializes drag operation, stores task data
 * 2. dragover - Updates visual feedback during drag
 * 3. drop - Handles task movement between boards
 * 4. dragend - Cleanup after drag operation
 */
function handleDragStart(e, task, boardId) {
  draggedTask = task;
  sourceBoard = boardId;
  e.target.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

/**
 * Cleans up after drag operation
 * @param {DragEvent} e - Drag event
 */
function handleDragEnd(e) {
  e.target.classList.remove("dragging");
  draggedTask = null;
  sourceBoard = null;
}

// Add this function after the handleDragEnd function
/**
 * Updates task order within a board
 * @param {string} boardId - ID of the board
 * @param {HTMLElement} tasksContainer - Container element holding the tasks
 */
function updateTaskOrder(boardId, tasksContainer) {
  const taskElements = tasksContainer.querySelectorAll(".task");
  const updatedTasks = [];

  taskElements.forEach((taskEl) => {
    const taskId = taskEl.dataset.id;
    const task = tasks[boardId].find((t) => t.id === taskId);
    if (task) {
      updatedTasks.push(task);
    }
  });

  tasks[boardId] = updatedTasks;
  saveTasks();
}

// Then modify the boards.forEach event listener to include the new logic:
boards.forEach((board) => {
  board.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const tasksContainer = board.querySelector(".tasks-container");
    const draggingElement = document.querySelector(".dragging");

    if (draggingElement) {
      const siblings = [
        ...tasksContainer.querySelectorAll(".task:not(.dragging)"),
      ];
      const nextSibling = siblings.find((sibling) => {
        const box = sibling.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        return offset < 0;
      });

      if (nextSibling) {
        tasksContainer.insertBefore(draggingElement, nextSibling);
      } else {
        tasksContainer.appendChild(draggingElement);
      }
    }
  });

  board.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!draggedTask) return;

    const targetBoard = board.dataset.board;
    const tasksContainer = board.querySelector(".tasks-container");

    if (sourceBoard === targetBoard) {
      // If dropping in the same board, update task order
      updateTaskOrder(targetBoard, tasksContainer);
    } else {
      // If dropping in a different board, move task to new board
      moveTaskToBoard(draggedTask.id, targetBoard);
    }
  });
});

// Set up drag and drop for boards
boards.forEach((board) => {
  board.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const tasksContainer = board.querySelector(".tasks-container");
    const draggingElement = document.querySelector(".dragging");

    if (draggingElement) {
      const siblings = [
        ...tasksContainer.querySelectorAll(".task:not(.dragging)"),
      ];
      const nextSibling = siblings.find((sibling) => {
        const box = sibling.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        return offset < 0;
      });

      if (nextSibling) {
        tasksContainer.insertBefore(draggingElement, nextSibling);
      } else {
        tasksContainer.appendChild(draggingElement);
      }
    }
  });

  board.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!draggedTask) return;

    const targetBoard = board.dataset.board;
    if (sourceBoard === targetBoard) return;

    moveTaskToBoard(draggedTask.id, targetBoard);
  });
});

/**
 * Theme Management
 * Toggles between light and dark mode
 * Persists theme preference
 */
function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle("light-mode");
  document.body.classList.toggle("dark-mode");
  moonIcon.classList.toggle("hidden");
  sunIcon.classList.toggle("hidden");
  localStorage.setItem("darkMode", isDarkMode);
}

/**
 * Tag Management
 * Toggles selection state of tags
 * @param {string} tag - Tag to toggle
 */
function toggleTag(tag) {
  const index = selectedTags.indexOf(tag);
  if (index === -1) {
    selectedTags.push(tag);
  } else {
    selectedTags.splice(index, 1);
  }
  renderTags();
}

/**
 * Updates visual representation of tag selection
 * Reflects currently selected tags
 */
function renderTags() {
  const tagButtons = tagsContainer.querySelectorAll(".tag");
  tagButtons.forEach((button) => {
    const tag = button.dataset.tag;
    button.classList.toggle("selected", selectedTags.includes(tag));
  });
}

/**
 * Application Initialization
 * Sets up initial state and event listeners
 * Loads saved preferences and data
 */
function initialize() {
  // Load saved data
  const savedTaskOrigins = localStorage.getItem("taskOrigins");
  if (savedTaskOrigins) {
    taskOrigins = JSON.parse(savedTaskOrigins);
  }

  // Load theme preference
  const savedDarkMode = localStorage.getItem("darkMode") === "true";
  if (savedDarkMode) {
    isDarkMode = true;
    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-mode");
    moonIcon.classList.add("hidden");
    sunIcon.classList.remove("hidden");
  }

  /**
   * Event Handling for Task Creation
   * - taskInput: Keyboard event for Enter key
   * - addTaskButton: Click event
   * Both trigger the addTask() function
   */
  addTaskButton.addEventListener("click", addTask);
  taskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addTask();
  });
  themeToggle.addEventListener("click", toggleTheme);
  searchInput.addEventListener("input", renderTasks);

  tagsContainer.querySelectorAll(".tag").forEach((button) => {
    button.addEventListener("click", () => toggleTag(button.dataset.tag));
  });

  renderTasks();
  renderTags();
}

// Initialize the application when the script loads
initialize();
