/**
 * Trivia Game Application
 * Author: Ashlyn Dedert
 * 
 * Dependencies: 
 * - Open Source Trivia: https://opentdb.com
 * 
 * Features:
 * - Fetches questions from OpenTDB API
 * - Select question amount
 * - Optional timer per question
 * - Optional 50/50 hint
 * - Score tracking
**/

const questionTime = 15; // seconds per question

const state = {
    questions: [],
    currentQuestion: 0,
    score: 0,
    numQuestions: 5,
    timerEnabled: true,
    hintsEnabled: true
};

let timerInterval = null;
let timeLeft = 0;

document.addEventListener("DOMContentLoaded", loadCategories);

/**
 * Fetches trivia categories from OpenTDB API and populates the category dropdown.
**/
async function loadCategories() {
    try {
        // Fetch categories from the OpenTDB API
        const response = await fetch('https://opentdb.com/api_category.php');
        const data = await response.json();
        const categorySelect = document.getElementById('category');

        // Loop through each category and add it to the dropdown
        data.trivia_categories.forEach(c => {
            const option = document.createElement("option");
            option.value = c.id;
            option.textContent = c.name;
            categorySelect.appendChild(option);
        });

        // Enable the start button now that categories are loaded
        document.getElementById("startButton").disabled = false;
    } catch (error) {
        console.error("Failed to load categories:", error);
    }
}

/**
 * Starts the quiz by reading the selected category and options, 
 * hides the start form, and fetches the quiz questions.
 */
function startQuiz() {
    // Get the selected category and difficulty from the dropdowns
    const category = document.getElementById('category').value;
    const difficulty = document.getElementById('difficulty').value;

    // Check if timer or hints enabled
    state.timerEnabled = document.getElementById("enableTimer").checked;
    state.hintsEnabled = document.getElementById("enableHints").checked;

    // Hide the start form, set the quiz container to loading, fetch the quiz questions based on choices.
    document.getElementById('startForm').style.display = 'none';
    resetQuizContainer("Loading questions...");
    fetchQuestions(category, state.numQuestions, difficulty);
}

/**
 * Fetches multiple-choice questions from OpenTDB API for the selected category.
 * 
 * @param {string} category - The category ID from the dropdown.
 * @param {number} num - Number of questions to fetch.
 * @param {string} difficulty - Difficulty of questions to pull.
 */
async function fetchQuestions(category, num, difficulty) {
    try {
        // Build the API URL with the selected options, then fetch from OpenTDB
        let url = `https://opentdb.com/api.php?amount=${num}&category=${category}&type=multiple&difficulty=${difficulty}`;
        const response = await fetch(url);

        // Check for network or server errors
        if (!response.ok) {
            throw new Error("Server returned " + response.status);
        }

        // Parse JSON response
        const data = await response.json();

        // If there are no results or an error code show a message.
        if (data.response_code !== 0 || !data.results || data.results.length === 0) {
            resetQuizContainer("Too many requests. Please wait a few seconds and try again.");
            return;
        }

        // Save the questions and reset current question and score
        state.questions = data.results;
        state.currentQuestion = 0;
        state.score = 0;

        showQuestion();

    } catch (error) {
        resetQuizContainer("Failed to load questions. Try again in a few seconds.");
        console.error(error);
    }
}

/**
 * Displays the current question and answer buttons.
 * Randomly shuffles the answers.
 * Enables hint button if hints are enabled.
 */
function showQuestion() {
    // Step any running timer before new question
    clearInterval(timerInterval);

    // If done with questions show final score
    if (state.currentQuestion >= state.questions.length) {
        return showScore();
    }

    const q = state.questions[state.currentQuestion];

    // Combine all answers and shuffle so the correct answer moves position
    const answers = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);

    // Update question and clear answer and feedback
    document.getElementById("question").textContent = decodeHTML(q.question);
    const answersContainer = document.getElementById("answers");
    answersContainer.innerHTML = "";
    document.getElementById("feedback").textContent = "";

    // Create a button for each answer
    answers.forEach(a => {
        const btn = document.createElement("button");
        const decoded = decodeHTML(a);
        btn.innerText = decoded;
        btn.dataset.answer = decoded;
        btn.onclick = () => checkAnswer(decoded, decodeHTML(q.correct_answer));
        answersContainer.appendChild(btn);
    });

    // If hints on re-enable the hint button
    const hintBtn = document.getElementById("hintButton");
    if (hintBtn) {
        hintBtn.hidden = false;
        hintBtn.disabled = false;
    }

    // Start the timer if enabled
    if (state.timerEnabled){
        startTimer();
    }
}

/**
 * Checks if the selected answer is correct.
 * Highlights buttons according to selection.
 * 
 * @param {string} selected - User selected answer (null if time up)
 * @param {string} correct - The correct answer for the current question.
 */
function checkAnswer(selected, correct) {
    // Stop the countdown for this question
    clearInterval(timerInterval);

    // Get all answer buttons
    const buttons = Array.from(document.querySelectorAll("#answers button"));

    buttons.forEach(b => {
        // Disable all buttons so user can't click multiple times
        b.disabled = true;
        const text = b.dataset.answer;

        if (text === correct) {
            // Highlight correct answer green
            b.classList.add("correct");

            // If correct update score
            if (selected === correct){
                state.score++;
            }
        } else if (!selected || text === selected) {
            // If user selected wrong or time ran out highlight red
            b.classList.add("wrong");
        }
    });

    // Short delay before next question
    setTimeout(() => { 
        state.currentQuestion++; 
        showQuestion(); 
    }, 1500);
}

/**
 * Displays the final score at the end of the quiz.
 * Shows total score, percentage, and a restart button
 */
function showScore() {
    // Replace the quiz container with the score summary
    document.getElementById("quiz").innerHTML = `
        <h2>Quiz Complete!</h2>
        <p>Your score: ${state.score} / ${state.questions.length}</p>
        <p>Percentage: ${Math.round((state.score / state.questions.length) * 100)}%</p>
        <button onclick="restartQuiz()">Play Again</button>
    `;
}

/**
 * Resets the quiz state and displays the start form
 */
function restartQuiz() {
    // Show the start form so the user can change quiz selections
    document.getElementById("startForm").style.display = "block";
    
    // Clear quiz container and reset quiz state variables
    resetQuizContainer();
    state.questions = [];
    state.currentQuestion = 0;
    state.score = 0;

    // Hide the hint button until next quiz
    document.getElementById("hintButton").hidden = true;
}

/**
 * Starts the countdown timer for the current question.
 * If time runs out calls checkAnswer() with null.
 */
function startTimer() {
    // Reset time for each question and show inital time
    timeLeft = questionTime; 
    const timerEl = document.getElementById("timer");
    timerEl.textContent = `Time: ${timeLeft}s`;

    clearInterval(timerInterval);

    // Start a new interval that updates every second
    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = `Time: ${timeLeft}s`;

        if (timeLeft <= 0) {
            // Stops countdown and calls checkAnswer with null to show time out
            clearInterval(timerInterval);
            checkAnswer(null, state.questions[state.currentQuestion].correct_answer);
        }
    }, 1000);
}

/**
 * Removes 2 incorrect answer buttons from the current question.
 * Disables the hint buttons after use.
 */
function useHint() {
    const q = state.questions[state.currentQuestion];
    const correct = decodeHTML(q.correct_answer);

    const buttons = Array.from(document.querySelectorAll("#answers button"));
    const wrongButtons = buttons.filter(btn => decodeHTML(btn.innerText) !== correct);

    // Randomly pick 2 wrong answers to remove
    let removeCount = Math.min(2, wrongButtons.length);
    while (removeCount > 0) {
        const index = Math.floor(Math.random() * wrongButtons.length);
        wrongButtons[index].style.display = "none"; // hide the button
        wrongButtons.splice(index, 1);
        removeCount--;
    }

    // Hide button after use
    const hintBtn = document.getElementById("hintButton");
    if (hintBtn) {
        hintBtn.hidden = true;
    }
}

/**
 * Resets the quiz container to a blank state or show a loading/message.
 * Adds timer or hint button if enabled.
 * 
 * @param {string} message - Optional message to display
 */
function resetQuizContainer(message = "") {
    document.getElementById("quiz").innerHTML = `
        ${state.timerEnabled ? '<div id="timer"></div>' : ''}
        <h2 id="question">${message}</h2>
        <div id="answers"></div>
        <div id="feedback"></div>
        ${state.hintsEnabled? '<button id="hintButton" onclick="useHint()">50/50 Hint</button>' : ''}
    `;
}

/**
 * Converts HTML entities from the OpenTDB API response into normal text.
 * 
 * @param {string} html - HTML-encoded string
 * @return {string} Decoded string
 */
function decodeHTML(html) {
    const text = document.createElement("textarea");
    text.innerHTML = html;
    return text.value;
}

/**
 * Sets the number of questions for the quiz and updates the UI buttons selection
 * 
 * @param {number} n - Number of questions to select (5 or 10)
 */
function selectNumQuestions(n) {
    state.numQuestions = n;
    document.getElementById("button5").classList.toggle("selected", n === 5);
    document.getElementById("button10").classList.toggle("selected", n === 10);
}