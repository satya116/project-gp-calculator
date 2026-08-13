/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 */
define([
  "N/runtime",
  "N/error",
  "N/record",
  "./gp_utils_utils",
  "./gp_utils_queue_record",
], function (runtime, error, record, Utils, QueueUtil) {
  var JOB_NAME = "grossprofitrecalc";

  function getSetupFieldData() {
    var setupFieldsData = runtime
      .getCurrentScript()
      .getParameter({ name: "custscript_gp_setup_fields" });
    var setupFields;
    if (!setupFieldsData) {
      throw error.create({
        name: "SUITE_GROSS_PROFIT_ERROR",
        message: "GP setup is not yet completed.",
        notifyOff: false,
      });
    }

    try {
      setupFields = JSON.parse(setupFieldsData);
    } catch (ex) {
      log.error({
        title: "SUITE_GROSS_PROFIT_ERROR",
        details: "Setup data is corrupted. Please re-run setup.",
      });

      log.error({
        title: "GP setup data",
        details: setupFieldsData,
      });

      throw error.create({
        name: "SUITE_GROSS_PROFIT_ERROR",
        message:
          "Invalid format recieved from 'Setup' " +
          "for sales order search Id.",
        notifyOff: false,
      });
    }
    return setupFields;
  }

  function getInputData() {
    try {
      var setupFields = getSetupFieldData();
      var recordIdsToUpdate = QueueUtil.getAllQueuedRecords({
        integrationName: JOB_NAME,
      });
    } catch (ex) {
      Utils.logErrorAndStack({
        title: "SUITE_ERROR_OCCURRED_WHILE_SCHEDULING_MAP_REDUCE",
        exception: ex,
      });
      recordIdsToUpdate = [];
    }

    return recordIdsToUpdate;
  }

  function map(context) {
    log.debug({ title: "data", details: context });

    try {
      var data = JSON.parse(context.value);

      record
        .load({
          type: "salesorder",
          id: data.transaction,
          isDynamic: true,
        })
        .save();

      QueueUtil.removeFromQueue({ id: data.id });
    } catch (ex) {
      log.error({ title: "failed to update order", details: context });
      Utils.logErrorAndStack({
        title: "Failed to update an order",
        exception: ex,
      });
    }
  }

  return {
    getInputData: getInputData,
    map: map,
  };
});
