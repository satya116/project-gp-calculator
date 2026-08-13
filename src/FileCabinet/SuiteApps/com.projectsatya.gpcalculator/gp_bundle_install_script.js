/**
 * @NApiVersion 2.0
 * @NScriptType BundleInstallationScript
 */
define(["N/record", "N/error", "N/runtime", "N/file"], function (
  record,
  error,
  runtime,
  file,
) {
  /**
   * @param {Object} args
   * @prop  {String} args.fileName
   */
  function backupCreation(args) {
    var fileObject = {};
    try {
      if (!args.fileName) {
        throw error.create({
          name: "SUITE_POSTEVENT_BACKUP_ERROR",
          message:
            "Please provide file name, which you supposed to create backup.",
          notifyOff: false,
        });
      }
      try {
        fileObject = file.load({
          id:
            "SuiteBundles/Bundle " +
            runtime.getCurrentScript().bundleIds[0] +
            "/" +
            args.fileName,
        });
      } catch (ex) {
        log.audit({
          title: "gp_FILE_LOAD_ERROR",
          details: ex.message || ex.name,
        });
        return;
      }

      var backupFile = file.create({
        name: "backupfile",
        fileType: file.Type.JAVASCRIPT,
        contents: fileObject.getContents(),
      });
      backupFile.name = "backup_" + args.fileName;
      backupFile.folder = fileObject.folder;
      return backupFile.save();
    } catch (ex) {
      log.error({
        title: "BACKUP_FILE_CREATION_ERROR",
        details:
          "Backup file creation error occurred for " +
          args.fileName +
          " due to- " +
          ex.message,
      });

      log.error({
        title: "STACK_TRACE",
        details: "Stack Trace - " + ex.stack,
      });

      throw error.create({
        name: "SUITE_POSTEVENT_BACKUP_ERROR",
        message:
          "Backup file creation error occurred for " +
          args.fileName +
          " due to- " +
          ex.message,
        notifyOff: false,
      });
    }
  }

  /**
   * @param {Object} args
   * @prop  {String} args.fileName
   */
  function restoreBackup(args) {
    var fileObject = {};
    try {
      if (!args.fileName) {
        throw error.create({
          name: "SUITE_POSTEVENT_BACKUP_ERROR",
          message:
            "Please provide file name, which you supposed to restore backup.",
          notifyOff: false,
        });
      }

      try {
        fileObject = file.load({
          id:
            "SuiteBundles/Bundle " +
            runtime.getCurrentScript().bundleIds[0] +
            "/backup_" +
            args.fileName,
        });
      } catch (ex) {
        log.audit({
          title: "gp_FILE_LOAD_ERROR",
          details: ex.message || ex.name,
        });
        return;
      }

      var postEventFile = file.create({
        name: "grossprofit",
        fileType: file.Type.JAVASCRIPT,
        contents: fileObject.getContents(),
      });
      postEventFile.folder = fileObject.folder;
      postEventFile.name = args.fileName;
      return postEventFile.save();
    } catch (ex) {
      log.error({
        title: "BACKUP_RESTORE_ERROR",
        details:
          "Backup restore error occurred for " +
          args.fileName +
          " due to- " +
          ex.message,
      });

      log.error({
        title: "STACK_TRACE",
        details: "Stack Trace - " + ex.stack,
      });

      throw error.create({
        name: "gp_BACKUP_RESTORE_ERROR",
        message:
          "Backup restore error occurred for " +
          args.fileName +
          " due to- " +
          ex.message,
        notifyOff: false,
      });
    }
  }

  function beforeUpdate() {
    try {
      backupCreation({ fileName: "gp_postevent.js" });
    } catch (ex) {
      log.error({
        title: "Backup File Creation Error",
        message: ex.message || ex.name,
      });

      throw error.create({
        name: "gp_POSTEVENT_BACKUP_ERROR",
        message: ex.message || ex.name,
      });
    }
  }

  function afterUpdate() {
    try {
      restoreBackup({ fileName: "gp_postevent.js" });
    } catch (ex) {
      log.error({
        title: "Backup Restore Error",
        message: ex.message || ex.name,
      });

      throw error.create({
        name: "GP_POSTEVENT_BACKUP_RESTORE_ERROR",
        message: ex.message || ex.name,
      });
    }
  }

  return {
    beforeUpdate: beforeUpdate,
    afterUpdate: afterUpdate,
  };
});
