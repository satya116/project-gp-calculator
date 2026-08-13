/**
 * UtilVersion 1.0.2
 */
var t1 = new Date();
var thisRoot = this;

define([
  "N/ui/serverWidget",
  "N/search",
  "N/error",
  "N/url",
  "N/record",
  "N/runtime",
  "N/config",
  "N/transaction",
  "N/task",
  "./gp_utils_lodash",
], function (
  ui,
  search,
  error,
  url,
  record,
  runtime,
  config,
  transaction,
  task,
  _,
) {
  var __context;
  var __configuration = {};

  /**
   *
   *Common styling for error, success and warning message
   */
  var COMMON_STYLE =
    " padding: 15px;" +
    " border: 1px solid transparent;" +
    " border-radius: 4px; font-size: 10pt;" +
    ' margin-top: 5px;"';

  /**
   *	An empty Proxy function for inheritance util
   */
  var F = function () {};

  var isNotNullAndUndefined = function (object) {
    if (object !== undefined || object !== null) {
      return true;
    }
    return false;
  };

  var isNotNullAndUndefined2 = function (object) {
    if (object !== undefined && object !== null) {
      return true;
    }
    return false;
  };

  var microserviceName = undefined;
  function getMicroserviceHostName() {
    if (microserviceName === undefined) {
      microserviceName = runtime
        .getCurrentScript()
        .getParameter({ name: "custscript_microservice_host_url" });
    }
    return microserviceName;
  }

  /**
   * @param {Object} args
   * @prop  {Object} args.title     - Title used while logging error message
   * @prop  {Object} args.exception
   */
  function logErrorAndStack(args) {
    var requestId = "";
    log.error({
      title: args.title || "Error Message",
      details:
        "requestId=" +
        requestId +
        ", code=" +
        (args.exception.code || "") +
        ", message=" +
        (args.exception.message || ""),
    });
    log.error({
      title: "Error Stack",
      details: args.exception.stack || "",
    });
    return requestId;
  }

  /**
   * @param {Object} args
   * @prop {Object} args.error
   * @prop {String} args.title
   * @prop {String} args.requestId
   */
  function logErrorAndThrowServerUnreachable(args) {
    var respError = args.error,
      throwError = args.throwError,
      title = args.title;
    var errorCodeMessageMap = {
      SSS_CONNECTION_CLOSED: {
        code: "SUITE_CONNECTION_ERROR",
        message:
          "Communication with server failed. If error persists please contact Support.",
      },
      SSS_CONNECTION_TIME_OUT: {
        code: "SUITE_CONNECTION_TIMEOUT",
        message:
          "Failed to establish connection with server. If error persists please contact Support.",
      },
      SSS_INVALID_HOST_CERT: {
        code: "SUITE_CONNECTION_URGENT_ERROR",
        message:
          "Failed to establish secure connection with server. Please contact support immediately.",
      },
      SSS_REQUEST_TIME_EXCEEDED: {
        code: "SUITE_CONNECTION_TIME_ERROR",
        message:
          "Service did not respond on time. If error persists please contact support.",
      },
      SSS_UNSUPPORTED_ENCODING: {
        code: "SUITE_CONNECTION_URGENT_ERROR",
        message:
          "NetSuite does not support this communication with service. Please contact support to resolve this.",
      },
      SSS_UNKNOWN_HOST: {
        code: "SUITE_CONNECTION_URGENT_ERROR",
        message:
          "Something went wrong while communicating with service. Please contact support to resolve this.",
      },
    };
    var errorObject = errorCodeMessageMap[respError.code];
    errorObject = errorObject ? errorObject : respError;
    logErrorAndStack({
      title: title || errorObject.code || "SUITE_SERVER_ERROR_OCCURRED",
      exception: errorObject,
    });

    throw error.create({
      name: errorObject.code,
      message: errorObject.message,
    });
  }

  /**
   * @param {Object} args
   * @prop {N/form} args.form       Form to append the error, else it creates new form
   * @prop {Object} args.exception
   * @prop {String} args.title      Message Title
   * @prop {String} args.message    If not present then default message is created using args.title
   * @returns {N/form}
   */
  function getErrorForm(args) {
    var form = args.form || ui.createForm({ title: args.title });
    var message =
      args.message ||
      args.title +
        " error occured due to - " +
        (args.exception.message || args.exception.code);
    if (args.requestId) {
      message = message + "<br />Ticket-Id: " + args.requestId;
    }
    form.addField({
      id: "custpage_error_util",
      type: ui.FieldType.INLINEHTML,
      label: "inline html",
    }).defaultValue =
      "<div " + style.ERROR_MESSAGE_STYLE + ">" + message + "</div>";
    return form;
  }

  /**
   * @param {Object} args
   * @prop {String} args.nsFieldType
   * @prop {Object} args.record - NetSuite record
   * @prop {Boolean} args.isMatrixOption
   */
  function getNetsuiteFieldsForSelectOptions(args) {
    var nsFieldType = args.nsFieldType,
      records = args.record;
    var netsuiteFieldsForSelectOptions = [];
    records.forEach(function (record) {
      record.getFields().forEach(function (fieldName) {
        var field = record.getField({ fieldId: fieldName });
        if (!field || !field.label) {
          return;
        }
        var fieldType = field.type.toUpperCase();
        nsFieldType.forEach(function (nsfieldTypeObject) {
          if (fieldType === nsfieldTypeObject) {
            if (
              args.isMatrixOption &&
              field.label.indexOf("Matrix Option -") === 0
            ) {
              netsuiteFieldsForSelectOptions.push({
                value: field.id.substring(12),
                text: field.label.substring(16),
              });
            } else if (
              args.isMatrixOption &&
              field.label.indexOf("Matrix Option -") !== 0
            ) {
              netsuiteFieldsForSelectOptions.push({
                value: field.id,
                text: field.label,
              });
            } else if (
              !args.isMatrixOption &&
              field.label.indexOf("Matrix Option -") !== 0
            ) {
              netsuiteFieldsForSelectOptions.push({
                value: field.id,
                text: field.label,
              });
            }
          }
        });
      });
    });

    netsuiteFieldsForSelectOptions = netsuiteFieldsForSelectOptions.sort(
      function (object1, object2) {
        return object1.text.toUpperCase() > object2.text.toUpperCase()
          ? 1
          : object2.text.toUpperCase() > object1.text.toUpperCase()
            ? -1
            : 0;
      },
    );
    netsuiteFieldsForSelectOptions = _.uniqWith(
      netsuiteFieldsForSelectOptions,
      _.isEqual,
    );
    return netsuiteFieldsForSelectOptions;
  }

  function logErrorAndGetForm(args) {
    args.requestId = logErrorAndStack({
      exception: args.exception,
      title: args.title,
    });
    return getErrorForm(args);
  }

  /**
   * @param {String} args.record
   * @param {String} args.fieldId
   * @param {String} args.fieldValue
   * @param {String} args.dataType
   * @param {Object} args
   */
  function validateFieldValueLengthSetValue(args) {
    var dataType = args.dataType;
    var fieldValue = args.fieldValue;
    var fieldId = args.fieldId;
    var nsRecord = args.record;

    var DATA_TYPE_LENGTH_MAP = {
      longtext: 1000000,
      text: 300,
      email: 254,
      url: 999,
      textarea: 4000,
      richtext: 100000,
    };

    var dataTypeList = [
      "longtext",
      "text",
      "email",
      "url",
      "textarea",
      "richtext",
    ];
    if (
      dataTypeList.indexOf(dataType) !== -1 &&
      fieldValue &&
      DATA_TYPE_LENGTH_MAP[dataType] < fieldValue.length
    ) {
      throw error.create({
        name: "SUITE_DATA_INVALID",
        message:
          "Length of specified field value exceeds the maximum length for " +
          fieldId +
          ".",
      });
    }

    nsRecord.setValue({
      fieldId: fieldId,
      value: fieldValue,
    });
  }

  function isTransaction(recordType) {
    return _.includes(transaction.Type, recordType);
  }

  /**
   * @desc  NetSuite currently supports UserEvent to SUBMIT TASK only if
   *      UserEvent is deployed with ADMIN PERMISSIONS
   *
   *    Fires Map/Reduce Script by checking Current-User Rights
   *    and logging provided/default error if user does not have sufficient rights
   *
   * @param  {Object} args
   * @prop   {String} args.scriptId
   * @prop   {String|Array} args.deploymentId - Pass an array if you want to schedule an another one if current is busy
   * @prop   {Integer} args.currentDeploymentIndex
   * @prop   {String} args.errorTitle
   * @prop   {String} args.errorMessage
   * @prop   {Boolean} args.skipRoleCheck
   * @prop   {ANY}    args.mapReduceParams
   *
   * @return task-Id
   */
  function validateAndFireMapReduceScript(args) {
    args.currentDeploymentIndex = args.currentDeploymentIndex || 0;

    var scriptId = args.scriptId;
    var deploymentId = _.isArray(args.deploymentId)
      ? args.deploymentId[args.currentDeploymentIndex]
      : args.deploymentId;
    var mapReduceParams = args.mapReduceParams || {};
    var errorTitle = args.errorTitle;
    var errorMessage = args.errorMessage;
    var skipRoleCheck = args.skipRoleCheck;

    log.debug({ title: "scriptId", details: scriptId });
    log.debug({ title: "deploymentId", details: deploymentId });
    log.debug({ title: "args.deploymentId", details: args.deploymentId });

    var DEFAULT_MAP_REDUCE_ERROR_TITLE =
      "SUITE_ERROR_OCCURRED_WHILE_SCHEDULING_MAP_REDUCE_SCRIPT";
    var DEFAULT_MAP_REDUCE_ERROR_MESSAGE =
      "Failed to Queue map/reduce script as the provillege on current user is in-sufficient.";

    try {
      var currentUserRoleId = runtime.getCurrentUser().roleId;
      if (
        currentUserRoleId !== "administrator" &&
        currentUserRoleId !== "full_access" &&
        skipRoleCheck !== true
      ) {
        log.error({
          title: errorTitle || DEFAULT_MAP_REDUCE_ERROR_TITLE,
          details: errorMessage || DEFAULT_MAP_REDUCE_ERROR_MESSAGE,
        });

        return undefined;
      } else {
        var taskId = task
          .create({
            taskType: task.TaskType.MAP_REDUCE,
            scriptId: scriptId,
            deploymentId: deploymentId,
            params: mapReduceParams,
          })
          .submit();

        log.debug({ title: "taskId", details: taskId });

        if (taskId) {
          var status = task.checkStatus(taskId).status;

          if (
            status === "PENDING" ||
            status === "QUEUED" ||
            status === "INQUEUE" ||
            status === "INPROGRESS" ||
            status === "SCHEDULED"
          ) {
            log.audit({
              title: "MAP_REDUCE_SCRIPT_SCHEDULED",
              details: "Map/Reduce Script Status: " + status,
            });
          } else {
            log.error({
              title: "MAP_REDUCE_SCRIPT_SCHEDULING_ERROR",
              details:
                "Error occurred while scheduling map reduce script. Script Status: " +
                status,
            });
          }
        }
        return taskId;
      }
    } catch (ex) {
      if (
        ex.name === "MAP_REDUCE_ALREADY_RUNNING" &&
        _.isArray(args.deploymentId)
      ) {
        if (args.currentDeploymentIndex < args.deploymentId.length - 1) {
          return validateAndFireMapReduceScript({
            scriptId: args.scriptId,
            deploymentId: args.deploymentId,
            currentDeploymentIndex: args.currentDeploymentIndex + 1,
            errorTitle: args.errorTitle,
            errorMessage: args.errorMessage,
            mapReduceParams: args.mapReduceParams,
          });
        }
      }

      log.error({
        title: "SUITE_ERROR_OCCURRED_WHILE_SCHEDULING_MAP_REDUCE",
        details:
          "Error occurred while scheduling map reduce. Error: " + ex.message,
      });
    }
  }

  var utils = {
    isNotNullAndUndefined: isNotNullAndUndefined,
    isNotNullAndUndefined2: isNotNullAndUndefined2,

    decodeBase64: function (base64str) {
      var e = 0;
      var cnt = 0;
      var len = base64str.length;
      var lst =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var total = "";
      for (cnt = 0; cnt < len; cnt++) {
        if (lst.indexOf(base64str.charAt(cnt)) != -1) {
          var currnum = lst.indexOf(base64str.charAt(cnt));
          var bin = currnum.toString(2);
          var temp = bin.length;
          while (temp < 6) {
            bin = "0" + bin;
            temp++;
          }
          total = total + bin;
        } else if (base64str.charAt(cnt) == "=") {
          e++;
        }
      }
      var hexg = total.substring(0, total.length - e * 2);
      var text = "";
      var curr = "";
      cnt = 0;
      while (cnt < hexg.length) {
        curr = hexg.substring(cnt, cnt + 8);
        var deci = parseInt(curr, 2).toString(10);
        text = text + String.fromCharCode(deci);
        cnt += 8;
      }
      return text;
    },

    http: {
      encodeURIComponentExtended: function (component) {
        return encodeURIComponent(component)
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
          .replace(/\'/g, "%27")
          .replace(/!/g, "%21")
          .replace(/\*/g, "%2A");
      },

      jsonToQueryParam: function (params, args) {
        return _.map(_.keys(params), function (k) {
          var encodedValue;

          if (args && args.extendedEncoding === true) {
            encodedValue = utils.http.encodeURIComponentExtended(
              params[k] === null ? "" : params[k],
            );
          } else {
            encodedValue = encodeURIComponent(
              params[k] === null ? "" : params[k],
            );
          }

          if (args && args.isSpaceAsPlus) {
            encodedValue = encodedValue.replace(/%20/g, "+");
          }

          return (
            encodeURIComponent(k) +
            (params[k] === null ? "" : "=") +
            encodedValue
          );
        }).join("&");
      },
    },

    json: {
      getJsonFieldValueFromJsonPath: function (json, jsonPath) {
        try {
          var splitData = jsonPath.split(".");
          var value = [];
          value = json[splitData[0]];
          if (splitData.length > 1) {
            for (var i = 1; i < splitData.length; i++) {
              value = value[splitData[i]];
            }
          }
          if (value != null && value != "undefined") {
            return value.toString();
          } else {
            return value;
          }
        } catch (ex) {
          log.error({
            title: "Json Path is not set correct - " + jsonPath,
            details: ex.message || ex.id,
          });
          return null;
        }
      },
    },

    style: {
      ERROR_MESSAGE_STYLE:
        'style="color: #a94442;' +
        " background-color: #f2dede;" +
        " border-color: #ebccd1;" +
        COMMON_STYLE,

      SUCCESS_MESSAGE_STYLE:
        'style="color: #3c763d;' +
        " background-color: #dff0d8;" +
        " border-color: #d6e9c6;" +
        COMMON_STYLE,

      WARNING_MESSAGE_STYLE:
        'style="color: #8a6d3b;' +
        " background-color: #fcf8e3;" +
        " border-color: #faebcc;" +
        COMMON_STYLE,
    },

    /**
     * @param Object
     * @prop Object.hostType
     */
    getNsDomain: function (param) {
      param = param || {};
      param.hostType = param.hostType || url.HostType.APPLICATION;

      return url.resolveDomain({
        hostType: param.hostType,
      });
    },

    getContext: function () {
      throw error.create({
        name: "SUITE_UNSUPPORTED_ERROR",
        message: "This method is not supported in 2.0 utils.",
      });
    },

    isSuiteCloudAccount: function () {
      return runtime.queueCount > 1;
    },

    getNsAccountNumber: function () {
      return runtime.accountId;
    },

    getNsEnvironment: function () {
      return runtime.envType;
    },

    getCompanyTimeZone: function () {
      return utils
        .getConfiguration(config.Type.COMPANY_INFORMATION)
        .getValue({ fieldId: "timezone" });
    },

    getConfiguration: function (type) {
      __configuration[type] =
        __configuration[type] ||
        config.load({
          type: type,
        });
      return __configuration[type];
    },

    getAnActiveEmployee: function () {
      var user = runtime.getCurrentUser().id,
        search;

      if (user !== -4 && user !== "-4") {
        return user;
      }

      search = search.create({
        type: "employee",
        filters: [
          ["internalid", "anyof", [-5]],
          "and",
          ["isinactive", "is", "F"],
          "and",
          ["giveaccess", "is", "T"],
        ],
      });

      var results = search.run().getRange({ start: 0, end: 1 });

      if (results && results.length === 1) {
        return -5;
      }

      search = search.create({
        type: "employee",
        filters: [["isinactive", "is", "F"], "and", ["giveaccess", "is", "T"]],
      });

      results = search.run().getRange({ start: 0, end: 1 });

      return results[0].id;
    },

    nsSearch: {
      getSearchColumnType: function (column) {
        return column.toJSON().type;
      },

      /**
       * @param args.searchId
       * @param args.search
       * @param args.filtersToAdd
       * @param args.filtersToSet
       * @param args.maxResults
       * @return Array of nlobjResults
       */
      getAllResults: function (args) {
        if (!args.search && !args.searchId) {
          throw error.create({
            name: "MISSING_REQUIRE_PARAM",
            message: "Either search or searchId is required.",
          });
        }

        log.debug({ title: "loading search with id", details: args.searchId });
        var nsSearchInstance =
          args.search || search.load({ id: args.searchId });

        if (args.filtersToAdd) {
          args.filtersToAdd.forEach(function (filter) {
            nsSearchInstance.filters.push(filter);
          });
        }

        if (args.filtersToSet) {
          nsSearchInstance.filters = [];
          args.filtersToSet.forEach(function (filter) {
            nsSearchInstance.filters.push(filter);
          });
        }

        var res = nsSearchInstance.run(),
          i = 0,
          tempResults,
          results = [];

        while (results.length % 1000 === 0) {
          tempResults = res.getRange({ start: i, end: i + 1000 }) || [];
          log.debug({
            title: "Utils search ran for Page",
            details: i / 1000 + 1,
          });
          results = results.concat(tempResults);
          i += 1000;
          if (tempResults.length <= 0) {
            break;
          }
        }

        return results;
      },

      /**
       * @param args.searchId
       * @param args.search
       * @param args.filtersToAdd
       * @param args.filtersToSet
       * @param args.page
       * @return Array of searchResults
       */
      getPagedResults: function (args) {
        if (!args.search && !args.searchId) {
          throw error.create({
            name: "MISSING_REQUIRE_PARAM",
            message: "Either search or searchId is required.",
          });
        }

        var search = args.search || search.load({ id: args.searchId });

        if (args.filtersToAdd) {
          args.filtersToAdd.forEach(function (filter) {
            search.filters.push(filter);
          });
        }

        if (args.filtersToSet) {
          search.filters = [];
          args.filtersToSet.forEach(function (filter) {
            search.filters.push(filter);
          });
        }

        var res = search.run(),
          i,
          results = [];

        if (args.page) {
          i = (args.page - 1) * 40;
        } else {
          i = 0;
        }

        results = results.concat(res.getRange({ start: i, end: i + 40 }) || []);
        /*while(results.length % 40 === 0){
          results = results.concat((res.getResults(i, i+40) || []));
          i += 40;
          if(results.length <= 0 || results.length > 0){
            break;
          }
        }*/
        return results;
      },
    },

    uuid: function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        },
      );
    },

    inherit: function (Child, Parent) {
      if (!Parent) {
        throw error.create({
          name: "SUITE_INHERITANCE_ERROR",
          message: "Please make sure parent class is defined.",
        });
      }
      F.prototype = Parent.prototype;
      Child.prototype = new F();
      Child.prototype.superclass = Parent;
      Child.prototype.constructor = Child;
    },

    logErrorAndThrowServerUnreachable: logErrorAndThrowServerUnreachable,

    /**
     * @param args
     * @prop args.sublist
     * @prop args.fieldIds
     * @prop args.values
     **/
    setUiSublistValues: function (args) {
      var fieldIds = args.fieldIds;
      var sublist = args.sublist;
      if (!fieldIds && args.values && args.values[0]) {
        fieldIds = Object.keys(args.values[0]);
      }
      (args.values || []).forEach(function (value, i) {
        fieldIds.forEach(function (fieldId) {
          if (
            utils.isNotNullAndUndefined2(value[fieldId]) &&
            value[fieldId] !== ""
          ) {
            sublist.setSublistValue({
              id: fieldId,
              value: value[fieldId],
              line: i,
            });
          }
        });
      });
    },

    /**
     * Modies the error array as bulleted numbered format
     *@param {Array} errors
     **/
    modifyError: function (errors) {
      if (!errors || !_.isArray(errors)) {
        return errors;
      }
      var toReturn = "";

      if (errors.length === 1) {
        var error = errors[0];
        if (_.isObject(error) && error.error) {
          toReturn += error.error + "\r\n";
        } else {
          toReturn += error + "\r\n";
        }
        return toReturn;
      }

      errors.forEach(function (error, i) {
        if (_.isObject(error) && error.error) {
          toReturn += i + 1 + ". " + error.error + "\r\n";
        } else {
          toReturn += i + 1 + ". " + error + "\r\n";
        }
      });
      return toReturn;
    },

    classCallCheck: function (instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw error.create({
          name: "SUITE_CALL_CLASS_ERROR",
          message: "Cannot call a class as a function.",
        });
      }
    },

    getScriptLevelParameter: function (param) {
      return runtime.getCurrentScript().getParameter({ name: param });
    },

    logErrorAndStack: logErrorAndStack,
    logErrorAndGetForm: logErrorAndGetForm,
    getErrorForm: getErrorForm,
    isTransaction: isTransaction,
    getNetsuiteFieldsForSelectOptions: getNetsuiteFieldsForSelectOptions,
    validateFieldValueLengthSetValue: validateFieldValueLengthSetValue,
    validateAndFireMapReduceScript: validateAndFireMapReduceScript,
  };

  Object.defineProperties(utils, {
    microServiceHostName: {
      get: getMicroserviceHostName,
    },
  });
  return utils;
});
