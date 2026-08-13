/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */
define([
  "N/ui/serverWidget",
  "./gp_utils_lodash",
  "./gp_utils_utils",
  "N/task",
  "./gp_jobform",
  "./gp_setup",
], function (ui, lodash, Utils, task, JobForm, SetupForm) {
  function sendError(context, args) {
    var form = ui.createForm({ title: args.title });
    var inlineField = form.addField({
      id: "custpage_gp_inline",
      type: ui.FieldType.INLINEHTML,
      label: "inline html",
    });
    inlineField.defaultValue =
      "<div " + Utils.style.ERROR_MESSAGE_STYLE + ">" + args.message + "</div>";
    return context.response.writePage(form);
  }

  function handleSetup(context) {
    if (context.request.method === "GET") {
      return context.response.writePage(SetupForm.getForm());
    } else if (context.request.method === "POST") {
      return context.response.writePage(SetupForm.saveForm(context.request));
    }
    return sendError(context, {
      title: "GrossProfit Setup",
      message: "Invalid Suitelet Call",
    });
  }
  function handleJob(context) {
    if (context.request.method === "GET") {
      return context.response.writePage(JobForm.getForm(ui));
    } else if (context.request.method === "POST") {
      return context.response.writePage(
        JobForm.handlePost(context.request, task, ui),
      );
    }
    return sendError(context, {
      title: "GrossProfit Jobs",
      message: "Invalid Suitelet Call",
    });
  }

  function getMrTaskStatus(context) {
    var request = context.request;
    var response = context.response;
    var parameters = request.parameters;

    if (parameters.action === "taskStatus") {
      var jsonResponse = { success: false };
      log.debug({ title: "MapReduce Poll Args", details: parameters });

      try {
        if (parameters.taskId) {
          jsonResponse.status = task.checkStatus(parameters.taskId).status;
          jsonResponse.success = true;
        } else {
          jsonResponse.message = "Task Id is missing";
        }
      } catch (ex) {
        jsonResponse.message = ex.message;
      }

      log.debug({
        title: "MapReduce Poll Result",
        details: {
          status: task.checkStatus(parameters.taskId),
          jsonResponse: jsonResponse,
        },
      });

      return response.write(JSON.stringify(jsonResponse));
    }
  }

  function onRequest(context) {
    var deployType = Utils.getScriptLevelParameter("custscript_gp_deployment");
    try {
      if (deployType === "Jobs") {
        return handleJob(context);
      } else if (deployType === "Setup") {
        return handleSetup(context);
      } else if (deployType === "taskstatus") {
        return getMrTaskStatus(context);
      }
    } catch (ex) {
      Utils.logErrorAndStack({
        title: "GrossProfit " + deployType + " Error",
        exception: ex,
      });
      return sendError(context, {
        title: "GrossProfit " + deployType,
        message: "An error occured: " + (ex.message || ex.code),
      });
    }
    return sendError(context, {
      title: "GrossProfit Error Page",
      message: "Invalid Suitelet Call",
    });
  }
  return {
    onRequest: onRequest,
  };
});
