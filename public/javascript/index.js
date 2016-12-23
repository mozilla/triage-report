(function() {
    var CONST_NUMBER_OF_COMPONENTS = 5; // how many components to show in the report
    var result = { bugs: [] };
    var limit = sizeOfResult = 500;
    var completed = 0;

    // base bugzilla API query 
    var baseAPIRequest = "https://bugzilla.mozilla.org/rest/bug?include_fields=id,priority,product,component&chfield=[Bug%20creation]&f1=flagtypes.name&f2=component&f3=component&f4=bug_id&o1=notequals&o2=notequals&o3=notequals&o4=greaterthan&resolution=---&v1=needinfo%3F&v2=general&v3=untriaged&limit=" + limit;

    var reportDetailRequest = "https://bugzilla.mozilla.org/buglist.cgi?chfield=[Bug%20creation]&chfieldfrom=2016-06-01&chfieldto=Now&f1=flagtypes.name&f2=component&f3=component&limit=0&o1=notequals&o2=notequals&o3=notequals&resolution=---&v1=needinfo%3F&v2=general&v3=untriaged";

    // convenience method for making links
    function buglistLink(value, product, component, priority) {
        priority = priority || null;
        var productEncoded = encodeURIComponent(product);
        var componentEncoded = encodeURIComponent(component);
        var url = `${reportDetailRequest}&product=${productEncoded}&component=${componentEncoded}`;
        if (priority) {
            url = `${url}&priority=${priority}`;
        }
        var link = `<a target="_blank" href="${url}">${value}</a>`;
        return link;
    }

    var tmp = document.querySelector('.tmp');
    var tableOuter = document.querySelector('table thead');

    if (!fetch) {
        view.innerHTML = "Your browser does not support the fetch standard, which is needed to load this page.";
        return;        
    }

    // This recursively fetches all the open bugs in Firefox related components opened since June 1st, 2016
    // which don't have a pending needinfo, and are not in the general and untriaged components
    // this does not include security filtered bugs 

    function getBugs(last) {
        var newLast;
        fetch(baseAPIRequest 
            + "&product=Core&product=Firefox&product=Firefox%20for%20Android&product=Firefox%20for%20iOS&product=Toolkit&chfieldfrom="
            + "2016-06-01&chfieldto=NOW&v4=" + last)
            .then(function(response) { // $DEITY, I can't wait for await 
                if (response.ok) {  
                    response.json()
                    .then(function(data) {
                        newLast = data.bugs[data.bugs.length - 1].id;
                        /* 
                            There are two ways we can fall out of this recursion: if the total
                            number of bugs is evenly divisible by limit (edge case) then we'll 
                            err on fetching a result set twice, but not adding it, or if the number
                            of bugs in the batch returned is less than the limit, we'll add the last
                            batch and stop 
                        */
                        if (newLast != last) {
                            completed ++;
                            console.log("completed", completed, "fetches");
                            Array.prototype.push.apply(result.bugs, data.bugs); // call push on each result.bugs
                            if (data.bugs.length === limit) {
                                console.log("calling again with last", newLast);
                                getBugs(newLast); // recursively call using the id of the last bug in the results as last                               
                            } else {
                                console.log("less bugs than limit");
                                complete();
                            }
                        } else {
                            console.log("edge case");
                            complete();
                        }
                    });
                }
            });
    }

    function complete() {
        console.log("all fetched!");
        process(result);
        setLastRunDate();
    }

    function process(result) {

        // stuff to collect results into
        var data = {};
        var report = {};
        var reportRows = '';
        var reportTable = '';
        var all = { '--': 0, P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, total: 0 };
        var top = { '--': 0, P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, total: 0 };

        // count bugs by product, component, and priority
        result.bugs.forEach((bug, i) => {
            if (!data[bug.product]) {
                data[bug.product] = {}; // add new product   
            }
            if (!data[bug.product][bug.component]) {
                data[bug.product][bug.component] = { // add new component
                    total: 0,
                    '--': 0,
                    P1: 0,
                    P2: 0,
                    P3: 0,
                    P4: 0,
                    P5: 0
                }
            }
            data[bug.product][bug.component].total ++;
            all.total ++;
            data[bug.product][bug.component][bug.priority] ++;
            all[bug.priority] ++;
        });

        // generate a report by product of the components sorted 
        // by the most untriaged bugs, descending
        Object.keys(data).forEach(product => {
            var list = [];
            Object.keys(data[product]).forEach(component => {
               list.push({component: component, untriaged: data[product][component]['--']});
            });
            report[product] = list.sort((a, b) => {
                return b.untriaged - a.untriaged; // sort in descending order
            });
        });

        // print the top five untriaged components in each product
        // and hey, lookit those ES6 format strings!
        Object.keys(report).forEach(product => {
            reportRows = reportRows + `<tbody>`;
            report[product].slice(0, CONST_NUMBER_OF_COMPONENTS).forEach(item => { // use Array().slice to get the top components 
                var component = item.component;
                reportRows = reportRows + `<tr>
                    <th>${product}: ${component}</th>
                    <td>${buglistLink(data[product][component]['--'], product, component,'--')}</td>
                    <td>${buglistLink(data[product][component].P1, product, component, 'P1')}</td>
                    <td>${buglistLink(data[product][component].P2, product, component, 'P2')}</td>
                    <td>${buglistLink(data[product][component].P3, product, component, 'P3')}</td>
                    <td>${buglistLink(data[product][component].P4, product, component, 'P4')}</td>
                    <td>${buglistLink(data[product][component].P5, product, component, 'P5')}</td>
                    <td>${buglistLink(data[product][component].total, product, component)}</td>
                </tr>`;
                // add to top components total
                top['--'] += data[product][component]['--'];
                top.P1 += data[product][component].P1;
                top.P2 += data[product][component].P2;
                top.P3 += data[product][component].P3;
                top.P4 += data[product][component].P4;
                top.P5 += data[product][component].P5;
                top.total += data[product][component].total;
            });
            reportRows = reportRows + `</tbody>`;        
        });

        // glue it all together
        reportTable = `${reportRows}
                <tbody>
                    <tr>
                        <th>All Components</th>
                        <td>${all['--']}</td>
                        <td>${all.P1}</td>
                        <td>${all.P2}</td>
                        <td>${all.P3}</td>
                        <td>${all.P4}</td>
                        <td>${all.P5}</td>
                        <td>${all.total}</td>                   
                    </tr>
                     <tr>
                        <th>Top Components</th>
                        <td>${top['--']}</td>
                        <td>${top.P1}</td>
                        <td>${top.P2}</td>
                        <td>${top.P3}</td>
                        <td>${top.P4}</td>
                        <td>${top.P5}</td>
                        <td>${top.total}</td>                   
                    </tr>
               </tbody>`;

        // put the report in the document
        tmp.remove();
        tableOuter.insertAdjacentHTML('afterend', reportTable);

    }

    function setLastRunDate() {
        document.querySelector('.updated p').insertAdjacentText('afterbegin', `Last updated at ${new Date().toTimeString()}; reload page to update.`);
    }

    getBugs(0);


})();

