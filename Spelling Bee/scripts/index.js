/**
 * index.js
 * - All our useful JS goes here, awesome!
**/



// Declare global variables. Will intialize them in a setup function.

// NY Times game data for the day.
var gameData;

// Words we are guessing.
var gameAnswers;

// Words that are pangrams (also appear in gameAnswers).
var gamePangrams;

// Max possible score for the puzzle. Initialize to the pangram bonus amount.
var maxScore = 7;

// Array of game rankings/levels.
var gameLevels;

// List of optional letters.
var outerLetters;

// List of buttons associated with the optional letters.
var outerLetterButtons;

// The one required letter.
var centerLetter;

// List of words guessed so far.
var answerList = [];

// Where the current word being typed appears on the page.
var wordGuessField;

// Where the currenct score appears on the page.
var gameScoreField;

// Where the current rank appears on the page.
var gameRankField;

// The popup window that displays various messages: score for correct word, all words found, duplicate word...
var submitPopupModal;

/**
 * This section of functions are all invovled in getting information from the NY Times Spelling Bee and setting up this local game.
 * Since the fetch function is asynchronous (returns a promise), all but the last of these functions must be promises as well.
 *
 * Here is a short description of how I current think about JS promises:
 * I think a promise as a special kind of JS object or function. Usually to access the value of an object you simply use its name
 * in an expression, eg "let foo = myThing", and the access the result of a function you simply use its name followed by "()", eg
 * "let foo = myThing()". But with a promise, using its name in an expression is like using the name of a function NOT followed
 * by "()", all it does is access the function itself, not its return value, eg "let foo = myFunction".
 * The ONLY way to access the value of the promise is to use the method ".then". This method isn't the typical accessor method, eg
 * "let foo = myThing.getValue", because the .then method actually takes a callback function as an argument. It is this callback
 * function that will be passed the value/result of the promise. What's cool about the .then method is that you can invoke it
 * on the promise whenever you want, eg even LONG AFTER the promise has been resolved. This is VERY different from a normal
 * function. With a normal function, you can only get its return result ONCE.
 *
 * At this point, I'll introduce the term "promissory". I call a function that is actually a promise a "promissory function" and
 * likewise for "promissory object". Thus, the cool thing about a promissory function is that its result can be accessed at any
 * time during the excution of an application and at many different locations in different functions comprising the app.
 * 
 * One last insight. Promise chaining, which I use below, isn't anthing special. It just enables you to fire off a series of
 * async functions and then ?????
**/



// Get the Spelling Bee webpage.
// fetch returns a promise wrapping a JS response object.
// @@TODO: Add error handling in case webpage is not available.
function getSpellingBee() {
  return fetch(
    "https://cors-anywhere.herokuapp.com/https://www.nytimes.com/puzzles/spelling-bee"
    // The webpage comes back as a JS response object, so covert it before returning it.
  ).then(response => response.text());
}

// The the string representing the webpage (HTML source) into  DOM object so we can call HTML/DOM methods on it.
// It returns a prom
function parseSpellingBee(htmlText) {
  return new Promise(function(resolve, reject) {
    let parser = new DOMParser();
    resolve(parser.parseFromString(htmlText, "text/html"));
  });
}

function getGameInfo(htmlTree) {
  return new Promise((resolve, reject) => {
    let gameData;
    let scripts = Array.from(htmlTree.getElementsByTagName("script"));
    scripts.some(script => {
      let text = script.innerText;
      let pos = text.search("window.gameData = {");
      if (0 <= pos && pos < 10) {
        gameData = JSON.parse(text.substring(text.search("{")));
        return true;
      }
      return false;
    });
    resolve({
      gameData: gameData,
      gameLevels: [
        ["Beginner", 0],
        ["Good Start", 2],
        ["Moving Up", 5],
        ["Good", 8],
        ["Solid", 15],
        ["Nice", 25],
        ["Great", 40],
        ["Amazing", 50],
        ["Genius", 70]
      ]
    });
  });
}

function setupGame(gameInfo) {
  gameData = gameInfo.gameData.today;
  gameAnswers = gameData.answers.map(letter => letter.toUpperCase());
  gamePangrams = gameData.pangrams.map(letter => letter.toUpperCase());
  gameAnswers.forEach(
    answer => {maxScore += (answer.length < 5 ? 1 : answer.length);}
  );
  gameLevels = gameInfo.gameLevels.map(level => [
    level[0],
    Math.round((level[1]/100)*maxScore)
  ]);
  outerLetters = gameData.outerLetters.map(letter => letter.toUpperCase());
  outerLetterButtons = Array.from(
    document.querySelectorAll(".outerLetter")
  ).sort((a, b) => a.innerText[1] - b.innerText[1]);
  centerLetter = gameData.centerLetter.toUpperCase();
  wordGuessField = document.getElementById("wordGuessField");
  gameScoreField = document.getElementById("gameScoreField");
  gameScoreField.value = 0;
  gameRankField = document.getElementById("gameRankField");
  submitPopupModal = document.getElementById("submitPopup");
  document.querySelector("#submit").onclick = submitHandler;
  document.querySelector("#delete").onclick = deleteHandler;
  document.querySelector("#rotate").onclick = rotateHandler;
  document.querySelectorAll(".outerLetter").forEach(aButton => {
    aButton.addEventListener("click", nlgClickHandler);
  });
  document
    .querySelector(".centerLetter")
    .addEventListener("click", nlgClickHandler);
  rotateLetters(outerLetterButtons);
  changeBtnLtr(document.querySelector(".centerLetter"), centerLetter);
}

function nlgClickHandler() {
  wordGuessField.value += this.innerText;
}

function deleteHandler() {
  wordGuessField.value = wordGuessField.value.slice(0, -1);
}

function submitHandler() {
  let guess = wordGuessField.value;
  let points = guessValue(guess);
  wordGuessField.value = "";
  if (points == 0) {
    displayModal("Not in word list");
    return;
  } else if (points == -1) {
    displayModal("Already found");
    return;
  }
  displayModal(points).then(result => {
    if (updateProgress(guess, Math.abs(points)))
      displayModal("You found them all!");
  });
}

function rotateHandler() {
  rotateLetters(outerLetterButtons);
}

function changeBtnLtr(ltrButton, Ltr) {
  ltrButton.innerText = Ltr;
}

function mapBtnLtr(ltrButton, index) {
  changeBtnLtr(ltrButton, outerLetters[index]);
}

function rotateLetters(ltrButtonArr) {
  ltrButtonArr.forEach(mapBtnLtr);
  outerLetters.unshift(outerLetters.pop());
}

function displayModal(message) {
  if (typeof message == "number") {
    message =
      (message < 0
        ? "Pangram!"
        : 7 <= message ? "Awesome!" : 1 < message ? "Nice!" : "Good!") +
      " +" +
      Math.abs(message);
  }
  return new Promise((resolve, reject) => {
    submitPopupModal.innerHTML = message;
    submitPopupModal.showModal();
    setTimeout(() => {
      submitPopupModal.close();
      resolve("closed");
    }, 750);
  });
}

function guessValue(word) {
  let value = 0;
  if (answerList.includes(word)) {
    return -1;
  }
  if (gameAnswers.includes(word)) {
    if (word.length < 5) {
      value = 1;
    } else {
      value = word.length;
    }
  }
  if (gamePangrams.includes(word)) {
    value = -7 - value;
  }
  return value;
}

function updateProgress(word, points) {
  let newScore = parseInt(gameScoreField.value) + points;
  gameScoreField.value = newScore;
  gameRankField.value = getRank(newScore);
  answerList.push(word);
  answerList.sort();
  listHTML = document.createElement("ol");
  answerList.forEach(word => {
    let li = document.createElement("li");
    listHTML.appendChild(li);
    li.innerHTML = word;
  });
  document.getElementById("answerList").firstChild.replaceWith(listHTML);
  return answerList.length == gameAnswers.length;
}

function getRank(score) {
  let rank;
  gameLevels.some((level, idx, arr) => {
    if (level[1] > score) {
      rank = arr[idx - 1][0];
      return true;
    } else return false;
  });
  return rank ? rank : gameLevels.slice(-1)[0][0];
}

getSpellingBee()
  .then(parseSpellingBee)
  .then(getGameInfo)
  .then(setupGame);
