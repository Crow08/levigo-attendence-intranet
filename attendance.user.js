// ==UserScript==
// @name         attendance duration
// @description  More information and general improvements to levigos intranet attendance table!
// @namespace    attendance
// @version      0.2.2
// @author       Kevin Hertfelder
// @match        https://intra.levigo.de/mitarbeiter/30tage.php
// @match        https://intra.levigo.de/mitarbeiter/anwesenheit.php
// @require      https://code.jquery.com/jquery-1.12.4.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.11.2/moment.js
// @downloadURL  https://levigo.de/bitbucket/users/hertfekn/repos/attendance-intranet/raw/attendance.user.js
// @updateURL    https://levigo.de/bitbucket/users/hertfekn/repos/attendance-intranet/raw/attendance.meta.js
// @grant        none
// ==/UserScript==

/* global $ moment */

// eslint-disable-next-line max-statements, wrap-iife, func-names
(function() {
  "use strict";

  // Configuration (user):
  let workerId = localStorage.getItem("attendance_workerId") || "";
  let workHours = parseFloat(localStorage.getItem("attendance_workHours")) || 8.75;

  let offsetHours = parseFloat(localStorage.getItem("attendance_offsetHours")) || 0;
  let offsetDays = parseFloat(localStorage.getItem("attendance_offsetDays")) || 0;
  let includeToday = localStorage.getItem("attendance_includeToday") === "true" || false;

  // Gather time information.
  let timeTags = null;
  let onVacationPlannerPage = false;
  gatherInformation();

  // Change background color.
  $("body").css("background-color", "rgb(0,79,158)");
  const controlBoxSelector =
    onVacationPlannerPage ? "body > center > table > tbody > tr > td > form > table" : "body > form > table";
  $(controlBoxSelector).css("background-color", "rgb(221,221,221)");
  $(controlBoxSelector).css("border", "2px solid black");

  // Calculate working time statistics.
  let isDuration = 0;
  let countDurations = 0;
  let workingDays = 0;
  let average = 0;
  let shouldDuration = 0;
  let divTime = 0;
  const today = moment().diff(moment([0, 1, 1]), "days") + 31;
  let firstDay = 999999;
  let lastDay = 0;
  calculateStatistics();

  // Displaying statistics
  let infoBox = null;
  let statistics = null;
  if (!onVacationPlannerPage) {
    buildInfoBox();
    $("body > form > center").append(infoBox);
    displayStatistics();
  }
  logStatistics();

  // Add Titles to color coded fields with text according to the legend.
  addDescriptionTitles();

  // Functions:
  // //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  function gatherInformation() {
    if (location.href === "https://intra.levigo.de/mitarbeiter/anwesenheit.php") { // Vacation planner.
      onVacationPlannerPage = true;

      workerId =
        $("body > center > table > tbody > tr > td > form > table > tbody > tr > td:nth-child(1)").html().substr(0, 5);

      timeTags = $("a");

    } else { // Attendance overview.

      if (!workerId) {
        return;
      }

      let userRow = null;
      const userTags = $("body > form > center > table> tbody > tr > td > table > tbody > tr > td > font");
      userTags.each((index, element) => {
        if ($(element).html().includes(workerId)) {
          userRow = $(element).parent().parent();
          return false; // Row found!
        }
        return true;
      });

      if (userRow === null) {
        return; // Row not Found!
      }

      timeTags = userRow.find($("a"));

      const userHeaderRow = userRow.parent().find("tr:nth-child(2)").clone();
      userHeaderRow.insertBefore(userRow.parent().find("tr:nth-child(2)"));
      userHeaderRow.find("font:first").html("user");

      userRow.insertBefore(userRow.parent().find("tr:nth-child(3)"));
    }
  }

  function calculateStatistics() {
    isDuration = moment.duration(offsetHours, "hours");
    countDurations = offsetDays;
    workingDays = offsetDays;

    if (!workerId || !timeTags) {
      return;
    }

    let timeArray = [];
    let startTime = null;
    let endTime = null;
    let duration = null;

    timeTags.each((index, element) => {
      if ($(element).parent().css("background-color") === "rgb(244, 80, 80)" ||
        $(element).parent().parent().parent().parent().parent().css("background-color") === "rgb(244, 80, 80)") {

        var url_string = $(element).attr("href");
        var url = new URL(url_string, window.location);
        var day = url.searchParams.get("eeday");

         /* if(day < minimumDay){
           return true;
         } */

        workingDays++;

        timeArray = $(element).html().split("<br>", (onVacationPlannerPage ? 3 : 2));
        if (timeArray.length < (onVacationPlannerPage ? 3 : 2)) {
          return true; // Not a time!
        }
        startTime = moment(timeArray[(onVacationPlannerPage ? 1 : 0)], "HH:mm");
        endTime = moment(timeArray[(onVacationPlannerPage ? 2 : 1)], "HH:mm");
        if (isNaN(startTime) || isNaN(endTime)) {
          return true;
        }
        $(element).html(timeArray.join("<br>"));
        duration = moment.duration(endTime - startTime);
        if (duration.asMilliseconds() === 0) {
          $(element).append("<br/>...");
          return true;
        }else if (duration < 0) {
          duration = moment.duration(24, "hours").add(duration);
        }

        if (includeToday || day != today) {
          isDuration += duration.asMilliseconds();
          countDurations++;
          if(firstDay > day){
            firstDay = day;
          }
          if(lastDay < day){
            lastDay = day;
          }
        }

        $(element).append(`<br/>${duration.hours()}h ${duration.minutes()}min`);
      }
      return true;
    });

    average = moment.duration(isDuration / countDurations);
    shouldDuration = (countDurations * workHours * 60 * 60 * 1000);
    divTime = moment.duration(isDuration - shouldDuration);
  }

  function logStatistics() {
    if (!workerId || !timeTags) {
      console.log("missing user information.");
      return;
    }
    // Console log statistics.
    console.log("first day:\t\t" + moment().add(firstDay - today, "days").format("YYYY-MM-DD"));
    console.log("last day:\t\t" + moment().add(lastDay - today, "days").format("YYYY-MM-DD"));
    console.log(`total time difference:\t${Math.trunc(divTime.asHours())}h ${divTime.minutes()}min`);
    console.log(`average time:\t\t\t${Math.trunc(average.asHours())}h ${average.minutes()}min`);
    console.log(`workdays:\t\t\t${workingDays}`);
    console.log(`workdays with times:\t${countDurations}`);
    console.log("total time is:\t\t\t" +
      `${Math.trunc(moment.duration(isDuration).asHours())}h ${moment.duration(isDuration).minutes()}min`);
    console.log("total time should:\t\t" +
      `${Math.trunc(moment.duration(shouldDuration).asHours())}h ${moment.duration(shouldDuration).minutes()}min`);
  }

  function displayStatistics() {
    if (!workerId || !timeTags) {
      statistics.html("missing user information.");
      return;
    }
    statistics.html(`<b>total time difference:</b><br/>&nbsp;&nbsp;&nbsp;${Math.trunc(divTime.asHours())}h ${divTime.minutes()}min<br/>` +
      `<b>average time:</b><br/>&nbsp;&nbsp;&nbsp;${Math.trunc(average.asHours())}h ${average.minutes()}min<br/>` +
      `<b>workdays:</b><br/>&nbsp;&nbsp;&nbsp;${workingDays} days<br/>` +
      `<b>workdays with times:</b><br/>&nbsp;&nbsp;&nbsp;${countDurations} days<br/>` +
      "<b>total time is:</b><br/>&nbsp;&nbsp;&nbsp;" +
      `${Math.trunc(moment.duration(isDuration).asHours())}h ${moment.duration(isDuration).minutes()}min<br/>` +
      "<b>total time should:</b><br/>&nbsp;&nbsp;&nbsp;" +
      `${Math.trunc(moment.duration(shouldDuration).asHours())}h ${moment.duration(shouldDuration).minutes()}min<br/>`);
  }

  // eslint-disable-next-line max-lines-per-function
  function buildInfoBox() {
    infoBox = $("<div/>").css({
      "background": "#dddddd",
      "border": "2px solid black",
      "padding": "4px",
      "position": "absolute",
      "top": "67px",
      "width": (($("body > form > center").width() - $("body > form > center > table:nth-child(1)").width()) / 2) - 10 + "px",
      "min-width": "146px"
    });

    statistics = $("<div/>").css({
      "font-size": "12",
      "text-align": "start"
    });

    const collapsibleSettings = $("<div/>");
    const cogSrc = "https://img.icons8.com/ios-filled/344/settings.png";
    const collapseBtn = $("<a/>").attr("href", "#").css("float", "right").
      append($("<img/>").attr("src", cogSrc).css("width", "20px"));

    const workerIdField = $("<input/>").attr("type", "text").attr("id", "userId").css("width", "60px").val(workerId);
    const workHoursField = $("<input/>").attr("type", "number").attr("step", "0.25").attr("id", "workHours").
      css("width", "60px").val(workHours);
    const offsetHoursField = $("<input/>").attr("type", "number").attr("step", "0.25").attr("id", "offsetHours").
      css("width", "60px").val(offsetHours);
    const offsetDaysField = $("<input/>").attr("type", "number").attr("step", "1").attr("id", "offsetDays").
      css("width", "60px").val(offsetDays);
    const includeTodayField = $("<input/>").attr("type", "checkbox").attr("id", "includeToday").
      prop("checked", includeToday);

    const collapseContent = $("<div/>").css({"display": "none", "background": "#f5f5f5"}).
      append($("<h1/>").css({"font-size": "18px", "float": "left"}).html("Settings:")).
      append($("<table/>").css("display", "inline").
        append($("<tr/>").
          append($("<td/>").
            append($("<label/>").attr("for", "userId").css("font-size", "12").html("<b>user id:</b>"))).
          append($("<td/>").
            append(workerIdField))).
        append($("<tr/>").
          append($("<td/>").
            append($("<label/>").attr("for", "workHours").css("font-size", "12").html("<b>work hours:</b>"))).
          append($("<td/>").
            append(workHoursField))).
        append($("<tr/>").
          append($("<td/>").
            append($("<label/>").attr("for", "offsetHours").css("font-size", "12").html("<b>offset hours:</b>"))).
          append($("<td/>").
            append(offsetHoursField))).
        append($("<tr/>").
          append($("<td/>").
            append($("<label/>").attr("for", "offsetDays").css("font-size", "12").html("<b>offset days:</b>"))).
          append($("<td/>").
            append(offsetDaysField))).
        append($("<tr/>").
          append($("<td/>").
            append($("<label/>").attr("for", "workHours").css("font-size", "12").html("<b>include today:</b>"))).
          append($("<td/>").
            append(includeTodayField))));

    collapseBtn.click((event) => {
      $(event.currentTarget).toggleClass("active");
      if (collapseContent.css("display") === "block") {
        collapseContent.css("display", "none");
      } else {
        collapseContent.css("display", "block");
      }
    });

    includeTodayField.add(workerIdField).change((event) => {
      workerId = workerIdField.val();
      includeToday = includeTodayField.is(":checked");
      localStorage.setItem("attendance_workerId", workerId);
      localStorage.setItem("attendance_includeToday", includeToday);
      location.reload();
    });

    workHoursField.add(offsetHoursField).add(offsetDaysField).change((event) => {
      workHours = parseFloat(workHoursField.val());
      offsetHours = parseFloat(offsetHoursField.val());
      offsetDays = parseFloat(offsetDaysField.val());
      localStorage.setItem("attendance_workHours", workHours);
      localStorage.setItem("attendance_offsetHours", offsetHours);
      localStorage.setItem("attendance_offsetDays", offsetDays);
      calculateStatistics();
      displayStatistics();
    });

    workHoursField.add(offsetHoursField).add(offsetDaysField).keypress((event) => {
      if (event.which === 13) {
        event.preventDefault();
        $(event.currentTarget).blur();
      }
    });

    collapsibleSettings.append(collapseBtn);
    collapsibleSettings.append(collapseContent);

    infoBox.append(statistics);
    infoBox.append(collapsibleSettings);
  }

  function addDescriptionTitles() {
    $("td").each((index, element) => {
      switch ($(element).attr("bgcolor")) {
      case "#999999":
        $(element).prop("title", "Wochenende");
        break;
      case "#9999EE":
        $(element).prop("title", "gesetzlicher Feiertag");
        break;
      case "#58B3FF":
        $(element).prop("title", "½ Tag geschenkt von levigo");
        break;
      case "#F45050":
        $(element).prop("title", "Arbeitstag");
        break;
      case "#FF8C21":
        $(element).prop("title", "Vorort Termin");
        break;
      case "#b70061":
        $(element).prop("title", "Heimarbeit");
        break;
      case "#DD9999":
        $(element).prop("title", "Wochenende");
        break;
      case "#277DB2":
        $(element).prop("title", "Ausbildung");
        break;
      case "#AF00B2":
        $(element).prop("title", "ärztliche Krankmeldung");
        break;
      case "#D141D3":
        $(element).prop("title", "mündliche Krankmeldung");
        break;
      case "#FCC4FF":
        $(element).prop("title", "unentschuldigt krank");
        break;
      case "#007f02":
        $(element).prop("title", "Urlaub genehmigt");
        break;
      case "#BEF9BB":
        $(element).prop("title", "Urlaub ungenehmigt");
        break;
      case "#6BD365":
        $(element).prop("title", "Urlaub abgelehnt");
        break;
      case "#C9FF4D":
        $(element).prop("title", "Überstundenabbau");
        break;
      case "#7DDAED":
        $(element).prop("title", "Unbezahlte Abwesenheit");
        break;
      case "#e2d030":
        $(element).prop("title", "ungeklärte Abwesenheit");
        break;
      default:
        break;
      }
    });
  }
})();
