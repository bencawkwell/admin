/*global $: false */

var utils = require('./utils'),
    core = require('kanso/core'),
    db = require('kanso/db'),
    kanso_utils = require('kanso/utils'),
    querystring = require('kanso/querystring');


exports.bind = function () {
    $('form').each(function () {
        $('.embedded, .embeddedlist', this).each(function () {
            exports.initRow(this);
            $('tr', this).each(function () {
                exports.updateRow(this);
            });
        });
    });
};

exports.initRow = function (row, action_callbacks) {
    action_callbacks = (_.defaults(action_callbacks, {
        add: exports.showModal
    });
    return exports.createAddBtn(field_td, action_callbacks.add);
};

exports.updateRow = function (row, action_callbacks) {
    action_callbacks = (_.defaults(action_callbacks, {
        edit: exports.showModal, del: null
    })
    var val = exports.getRowValue(row);
    var field_td = $(row).parent().parent().parent();
    if (val) {
        exports.addRowControls(
            row, action_handlers.add, action_handlers.del
        );
    }
    else {
        $(row).remove();
    }
    var row_count = $('tr', field_td).length;
    if (field_td.parent().hasClass('embedded')) {
        if (!row_count) {
            $('.addbtn', field_td).show();
        }
        else {
            $('.addbtn', field_td).hide();
        }
    }
    exports.renumberRows(field_td);
};

exports.getRowValue = function (row) {
    var str = $('input:hidden', row).val();
    if (!str) {
        return;
    }
    return JSON.parse(str);
};

exports.addRowControls = function (row, edit_callback, del_callback) {
    if (exports.getRowValue(row)) {
        var container = $('td.actions', row).html('');
        var editbtn = $('<input type="button" class="editbtn" value="Edit" />');
        var delbtn  = $('<input type="button" class="delbtn" value="Delete" />');
        editbtn.click(exports.editbtnHandler(edit_callback));
        delbtn.click(exports.delbtnHandler(del_callback));
        container.append(editbtn, delbtn);
    }
};

exports.createAddBtn = function (field_row, add_callback) {
    var addbtn = $('<input type="button" class="addbtn" value="Add" />');
    addbtn.click(exports.addbtnHandler(add_callback));
    // remove any existing add buttons
    $('.field .addbtn', field_row).remove();
    $('.field', field_row).append(addbtn);
};

exports.getModules = function (/*optional*/req, callback) {
    if (!callback) {
        /* Arity = 1: callback only */
        callback = req;
        req = core.currentRequest();
    }
    utils.getDesignDoc(req.query.app, function (err, ddoc) {
        if (err) {
            throw err;
        }
        var settings = utils.appRequire(ddoc, 'kanso/settings');
        var app = utils.appRequire(ddoc, settings.load);
        var forms = utils.appRequire(ddoc, 'kanso/forms');
        callback(settings, app, forms);
    });
};

exports.showModal = function (div, field_td, row, typename, val, rawval) {
    exports.getModules(function (settings, app, forms) {
        var type = app.types[typename];
        var form = new forms.Form(type, val);

        if (rawval) {
            form.validate(rawval);
        }

        div.html('<h2>' + (val ? 'Edit ': 'Add ') + typename + '</h2>');
        var divform = $('<form><table class="form_table"><tbody>' +
            form.toHTML() +
        '</tbody></table></form>');
        div.append(divform);

        var action = (val ? 'Update': 'Add');
        var okbtn = $('<input type="button" value="' + action  + '" />"');
        okbtn.click(function () {
            var qs = $('form', div).serialize().replace(/\+/g, '%20');
            var rawval = querystring.parse(qs);
            form.validate(rawval);
            if (form.isValid()) {
                if (!val) {
                    row = exports.addRow(field_td);
                }
                var jsonval = JSON.stringify(form.values);
                $('input:hidden', row).val(jsonval);
                $('span.value', row).text(form.values._id);
                exports.updateRow(row);
                $.modal.close();
            }
            else {
                exports.showModal(div, field_td, row, typename, val, rawval);
            }
        });
        div.append(okbtn);
        divform.submit(function (ev) {
            ev.preventDefault();
            okbtn.click();
            return false;
        });

        var cancelbtn = $('<input type="button" value="Cancel" />');
        cancelbtn.click(function () {
            $.modal.close();
        });
        div.append(cancelbtn);

        // generate ids when adding documents
        if (!val) {
            db.newUUID(100, function (err, uuid) {
                if (err) {
                    throw err;
                }
                $('input[name="_id"]', div).attr({
                    value: uuid
                });
            });
        }

        div.modal();
        utils.resizeModal(div);
    });
};

exports.renumberRows = function (field_td) {
    var field_row = field_td.parent();
    var name = $('table', field_td).attr('rel');
    if (field_row.hasClass('embeddedlist')) {
        $('tr', field_td).each(function (i) {
            $('input:hidden', this).attr({'name': name + '.' + i});
        });
    }
    else {
        $('input:hidden', field_td).attr({'name': name});
    }
};

exports.addRow = function (field_td) {
    var tr = $(
        '<tr>' +
            '<td>' +
                '<input type="hidden" value="" name="" />' +
                '<span class="value"></span>' +
            '</td>' +
            '<td class="actions"></td>' +
        '</tr>'
    );
    $('tbody', field_td).append(tr);
    return tr;
};

exports.getRowType = function (row) {
    var field_td = row.parent().parent().parent();
    return field_td.attr('rel');
};

exports.addbtnHandler = function (action_callback) {
    return function (ev) {
        var field_td = $(this).parent();
        var typename = field_td.attr('rel');
        var div = $('<div/>');
        if (action_callback) {
            action_callback(div, field_td, null, typename);
        }
    };
};

exports.editbtnHandler = function (action_callback) {
    return function (ev) {
        var row = $(this).parent().parent();
        var field_td = row.parent().parent().parent();
        var val = exports.getRowValue(row);
        var typename = exports.getRowType(row);
        var div = $('<div/>');
        if (action_callback) {
            action_callback(div, field_td, row, typename, val);
        }
    };
};

exports.delbtnHandler = function (action_callback) {
    return function (ev) {
        var row = $(this).parent().parent();
        $('input:hidden', row).val('');
        $('span.value', row).html('');
        exports.updateRow(row);
        if (action_callback) {
            action_callback(row);
        }
    };
};
