define(["N/error", "./gp_utils_utils"], function (error, Utils) {
  var JOB_DATA = {
    "Process Sales Order for Gross Profit": {
      scriptId: "customscript_gp_map_reduce_script",
      deploymentId: "customdeploy_gross_profit_proces",
    },
  };
  var PROCESSING_GIF =
    '<script type="text/javascript">' +
    'var css = "#inline-status{font-size: large !important;}' +
    "#processing-gif {" +
    "font-size: large !important;" +
    "}" +
    '", head = document.head || document.getElementsByTagName("head")[0],' +
    'style = document.createElement("style");' +
    'style.type = "text/css";' +
    "if(style.styleSheet){" +
    "style.styleSheet.cssText = css;" +
    "}else {" +
    "style.appendChild(document.createTextNode(css));" +
    "}" +
    "head.appendChild(style);" +
    "</script>" +
    '<link rel="stylesheet" href="https://dhulnj2mbbb02.cloudfront.net/common/css/font-awesome.min.css">';

  return {
    getForm: function (ui) {
      var form = ui.createForm({ title: "GP Jobs" });

      var field;
      field = form.addField({
        id: "job_list",
        type: ui.FieldType.SELECT,
        label: "Gross Profit Jobs",
      });
      field.setHelpText({
        help: "Choose gross profit job to be run on demand.",
      });

      var labels = Object.keys(JOB_DATA);
      labels.forEach(function (label) {
        field.addSelectOption({ value: label, text: label });
      });
      field.isMandatory = true;
      form.addSubmitButton({ label: "Submit" });
      return form;
    },

    handlePost: function (request, task, ui) {
      var form = ui.createForm({ title: "GP Jobs" });
      form.clientScriptModulePath = "./gp_task_status_client.js";

      form.addButton({
        id: "custpage_back_button",
        label: "Back to GP Jobs",
        functionName: "gp_back_to_job_runner",
      });

      log.debug({ title: "Job Value", details: request.parameters.job_list });
      var jobName = request.parameters.job_list;

      var mapReduceTask = task.create({
        taskType: task.TaskType.MAP_REDUCE,
        scriptId: JOB_DATA[jobName].scriptId,
        deploymentId: JOB_DATA[jobName].deploymentId,
      });
      var mapReduceTaskId = mapReduceTask.submit();
      var status = task.checkStatus(mapReduceTaskId).status;

      if (
        status === "PENDING" ||
        status === "QUEUED" ||
        status === "INQUEUE" ||
        status === "INPROGRESS" ||
        status === "SCHEDULED"
      ) {
        var field = form.addField({
          id: "custpage_gp_success",
          type: "inlinehtml",
          label: "Status",
        });
        field.defaultValue =
          PROCESSING_GIF +
          ("<div " +
            Utils.style.SUCCESS_MESSAGE_STYLE +
            ">" +
            "Job request for '" +
            jobName +
            "' is being processed.<br/>" +
            "<br/>Current status of request:</br>" +
            '<table id="inline-status">' +
            "<tr>" +
            '<td style="vertical-align: center">' +
            '<span id="task_status" style="white-space:nowrap; margin-right: 5px;"' +
            ' data-taskid="' +
            mapReduceTaskId +
            '"' +
            ' data-success="' +
            task.TaskStatus.COMPLETE +
            '"' +
            ' data-fail="' +
            task.TaskStatus.FAILED +
            '"' +
            ' data-success-message="' +
            "Job request has been processed successfully." +
            '"' +
            ' data-error-message="' +
            "Failed to process the request." +
            '"' +
            ">" +
            status +
            "</span>" +
            "</td>" +
            '<td style="vertical-align: center" id="processing-td">' +
            '<span class="fa fa-refresh fa-spin" id="processing-gif"></span>' +
            "</td>" +
            "</tr>" +
            "</table>" +
            "</div>");
      } else {
        throw error.create({
          name: "SUITE_MAGENTO_SCHEDULE_ERROR",
          message:
            "Failed to scheduled the script for Gross Profit - " +
            jobName +
            ". Status received: " +
            status +
            ". Please try again.",
        });
      }
      return form;
    },
  };
});
