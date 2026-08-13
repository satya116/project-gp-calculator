/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 *@NModuleScope Public
 */
define(["N/https", "N/url", "N/ui/message"], function (https, url, message) {
  let showMessage = (function () {
    let timeout = null;
    let nsMsg = null;

    /**
     * @desc -
     * @returns
     */
    function hide() {
      if (!nsMsg) return;
      nsMsg.hide();
      clearTimeout(timeout);
      nsMsg = null;
    }

    return function showMessage(args) {
      hide();
      if (args.success) {
        nsMsg = message.create({
          title: args.title || "Task Status Update",
          message: args.message,
          type: args.type || message.Type.CONFIRMATION,
        });
      } else {
        nsMsg = message.create({
          title: args.title || "Task Status Update",
          message: args.message,
          type: message.Type.ERROR,
        });
      }

      nsMsg.show();
      timeout = setTimeout(hide, 3500);
    };
  })();

  /**
   * @desc -
   */
  function _getMapReduceStatus() {
    let taskEle = document.getElementById("task_status");
    let taskId = taskEle.getAttribute("data-taskid");

    https.request
      .promise({
        method: https.Method.GET,
        url:
          url.resolveScript({
            scriptId: "customscript_gp_suitelet_2",
            deploymentId: "customdeploy_gp_task_status",
          }) +
          "&action=taskStatus&taskId=" +
          encodeURIComponent(taskId),
      })
      .then(function onResolve(response) {
        let result = response.body;
        try {
          result = JSON.parse(result);
        } catch (ex) {
          return showMessage({
            title: taskEle.getAttribute("data-error-message"),
            message: "Unexpected response received: " + result,
          });
        }
        if (result.success !== true) {
          return showMessage({
            title: taskEle.getAttribute("data-error-message"),
            message: result.error || "Unexpected Error",
          });
        }

        let currentStatus = (taskEle.innerText || "").trim();

        if (!result.status) {
          return showMessage({
            title: taskEle.getAttribute("data-error-message"),
            message: "No status found",
          });
        }

        if (currentStatus !== result.status) {
          let statusText = result.status;
          if (statusText === "COMPLETE" || statusText === "FAILED") {
            document.getElementById("processing-td").innerHTML = "";
          }
          taskEle.innerHTML = statusText;
          if (result.status === taskEle.getAttribute("data-fail")) {
            return showMessage({
              title: taskEle.getAttribute("data-error-message"),
              message: "Status : " + result.status,
            });
          } else if (result.status === taskEle.getAttribute("data-success")) {
            return showMessage({
              title: taskEle.getAttribute("data-success-message"),
              message: "Status: " + result.status,
              success: 1,
            });
          } else {
            showMessage({
              message: "Status : " + result.status,
              type: message.Type.INFORMATION,
              success: 1,
            });
          }
        }
        pollTaskStatus();
      })
      .catch(function onReject(response) {
        showMessage({
          title: taskEle.getAttribute("data-error-message"),
          message: response,
        });
      });
  }

  /**
   * @desc -
   */
  function getMapReduceStatus() {
    try {
      _getMapReduceStatus();
    } catch (ex) {
      alert("Failed to get the status of the running map-reduce script");
    }
  }

  /**
   * @desc -
   */
  function pollTaskStatus() {
    setTimeout(getMapReduceStatus, 10000);
  }

  /**
   * @param {Object} context
   */
  function pageInit() {
    window.pollTaskStatus = pollTaskStatus;
    let taskEle = document.getElementById("task_status");
    if (
      taskEle &&
      (taskEle.innerText || "").trim() !== taskEle.getAttribute("data-success")
    ) {
      pollTaskStatus();
    }
  }

  /**
   * @desc -
   */
  function backToJobRunner() {
    let urlToSearch = url.resolveScript({
      scriptId: "customscript_gp_suitelet_2",
      deploymentId: "customdeploy_gp_job_runner",
      returnExternalUrl: false,
    });

    window.location.href = urlToSearch;
  }

  return {
    pageInit: pageInit,
    gp_back_to_job_runner: backToJobRunner,
  };
});
