/**
 * UtilVersion 1.0.0
 */
define(["N/error", "N/search", "N/record", "./gp_utils_lodash"], function (
  error,
  search,
  record,
  _,
) {
  var MAX_QUEUE_RECORDS = 1000;
  var QUEUE_RECORD = {
    type: "customrecord_gp_job_queue",
    fieldIds: {
      transaction: "custrecord_gp_queue_transaction",
      item: "custrecord_gp_item_id",
      parentItem: "custrecord_gp_parent_item_id",
      lastModifiedDate: "custrecord_gp_last_modified_dat",
      recordType: "custrecord_gp_subitem_rec_type",
      dataIdentifier: "custrecord_gp_data_identifier",
      integrationName: "custrecord_gp_job_que_integ_name",
      retryCount: "custrecord_gp_job_qu_retry_count",
    },
  };

  /**
   *
   * @param {Object} args
   * @prop {String} args.integrationName
   **/
  function getAllQueuedRecords(args) {
    if (!args.integrationName) {
      throw error.create({
        name: "SUITE_QUEUE_DEVELOPER_ERROR",
        message: "integrationName is required to get all queued records",
      });
    }

    var queuedRecords = search
      .create({
        type: QUEUE_RECORD.type,
        filters: [
          ["isinactive", "is", "F"],
          "AND",
          [QUEUE_RECORD.fieldIds.integrationName, "is", args.integrationName],
        ],
        columns: _.values(QUEUE_RECORD.fieldIds),
      })
      .run()
      .getRange({ start: 0, end: MAX_QUEUE_RECORDS });

    return queuedRecords.map(function (queuedRecord) {
      return {
        transaction: queuedRecord.getValue({
          name: QUEUE_RECORD.fieldIds.transaction,
        }),
        item: queuedRecord.getValue({ name: QUEUE_RECORD.fieldIds.item }),
        parentItem: queuedRecord.getValue({
          name: QUEUE_RECORD.fieldIds.parentItem,
        }),
        lastModifiedDate: queuedRecord.getValue({
          name: QUEUE_RECORD.fieldIds.lastModifiedDate,
        }),
        recordType: queuedRecord.getValue({
          name: QUEUE_RECORD.fieldIds.recordType,
        }),
        retryCount: queuedRecord.getValue({
          name: QUEUE_RECORD.fieldIds.retryCount,
        }),
        id: queuedRecord.id,
      };
    });
  }

  /**
   *
   * @param {Object} args
   * @prop {String} args.integrationName
   * @prop {String} args.item
   * @prop {String} args.itemText
   * @prop {String} args.parentItem
   * @prop {String} args.parentItemText
   * @prop {String} args.recordType
   * @prop {String} args.dataIdentifier
   * @prop {String} args.transaction
   * @prop {String} args.transactionText
   **/
  function addToQueue(args) {
    var queueData = record.create({
      type: QUEUE_RECORD.type,
      isDynamic: true,
    });

    var TEXT_FIELD_IDS = ["item", "transaction", "parentItem"];

    TEXT_FIELD_IDS.forEach(function (textFieldId) {
      if (args[textFieldId + "_text"]) {
        queueData.setText({
          fieldId: QUEUE_RECORD.fieldIds[textFieldId],
          text: args[textFieldId + "_text"],
        });
      }
    });

    Object.keys(QUEUE_RECORD.fieldIds).forEach(function (fieldId) {
      if (args[fieldId]) {
        log.debug({
          title: "fieldId set - " + fieldId,
          details: args[fieldId],
        });
        queueData.setValue({
          fieldId: QUEUE_RECORD.fieldIds[fieldId],
          value: args[fieldId],
        });
      } else {
        log.debug({ title: "fieldId not set", details: fieldId });
      }
    });

    return queueData.save();
  }

  /**
   *
   * @param {Object} args
   * @prop {String} args.id
   **/
  function removeFromQueue(args) {
    return record.delete({
      type: QUEUE_RECORD.type,
      id: args.id,
    });
  }

  return {
    getAllQueuedRecords: getAllQueuedRecords,
    removeFromQueue: removeFromQueue,
    addToQueue: addToQueue,
  };
});
