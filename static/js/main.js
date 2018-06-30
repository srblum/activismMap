var ageIndex, 
	interestIndex,
	selectedCountry = "canada", 
	selectedVariable = "satisfaction";

var format = d3.format(",");

var margin = {top: 0, right: 0, bottom: 0, left: 0},
		width = 1200 - margin.left - margin.right,
		height = 600 - margin.top - margin.bottom;

var path = d3.geoPath();

var svg = d3.select("svg")
		.attr("width", width)
		.attr("height", height)
		.style('margin-top',75)
		.append('g')
		.attr('class', 'map');

var projection = d3.geoNaturalEarth1()
				.scale(250)
				.translate( [width / 2.2, height / 1.75]);

var path = d3.geoPath().projection(projection);

//For the most part, country names in the data correspond to the NAME_LONG attribute of the GeoJSON file
//The exceptions are stored in the object below
var sortNames2DataNames = {
	"united states":"united states of america",
	"swaziland":"eswatini",
	"czechia":"czech republic",
	"taiwan, china":"taiwan",
	"palestine (west bank and gaza)":"west bank and gaza"
} 

queue()
.defer(d3.json, "world_countries.json")
.defer(d3.tsv, "world_population.tsv")
.defer(d3.tsv, "survey_data2.txt") 	//exported as tsv from excel and 
									//converted to utf8 using  iconv -f LATIN1 -t UTF8 survey_data.txt >> survey_data2.txt
.await(ready);

function ready(error, world, population, data) {
	var populationById = {},
		dataByCountry = {},
		countryNames2Population = {},
		countrySuggestions = [],
		totalPopulation = 0,
		globals = [[{},{},{}],
					[{},{},{}],
					[{},{},{}]];	//This will contain population-adjusted averages for each of the nine sectors
	
	dataByCountry['globals'] = globals;

	//store populations populationById
	population.forEach(function(d) { 
		totalPopulation += +d.population;
		populationById[d.id] = +d.population; 
	});
	//pass the populations to the world object
	world.features.forEach(function(d) { d.population = populationById[d.properties.ADM0_A3] });
	//keep track of the correspondence between country codes and population in countryNames2Population
	world.features.forEach(function(d) {
		var name = d.properties.NAME_SORT;
		name = name.toLowerCase();
		if(sortNames2DataNames.hasOwnProperty(name)){
			name = sortNames2DataNames[name];
		}
		countryNames2Population[name] = populationById[d.properties.ADM0_A3];
	});

	//Translation functions from age and interest sectors in original data to the matrix indices in dataByCountry
	function getAgeIndex(age){
		if(age==='Uner 29'){
			return 0
		}else if(age==='29-38'){
			return 1
		}else if(age==='39+'){
			return 2
		}
	}
	function getInterestIndex(interest){
		if(interest==='1'){
			return 0
		}else if(interest==='5'){
			return 1
		}else if(interest==='9'){
			return 2
		}
	}

	data.forEach(function(d){
		//Fix a few country names to ensure they correspond with names in GeoJSON
		var country = d.Country.toLowerCase();
		if(sortNames2DataNames.hasOwnProperty(country)){
			country = sortNames2DataNames[country];
		}
		countrySuggestions.push(country);
		//Initialize with 3x3 matrix (age x interest)
		if(!dataByCountry.hasOwnProperty(country)){
			dataByCountry[country] =	[[{},{},{}],
										[{},{},{}],
										[{},{},{}]];
		}
		var ai = getAgeIndex(d["Age Group"]),
			ii = getInterestIndex(d["Interest in Politics"]);

		//Fill appropriate cell with named data
		var cell = dataByCountry[country][ai][ii];
		cell["satisfaction"] = +d["Satisfied with Government"];
		cell["voice"] = +d["Feel like have a voice"];
		cell["democracy"] = +d["Democracy Preferred"];
		cell["other"] = +d["Otner Preferred"];
		cell["protest"] = +d["Like to Protest"];
		cell["party"] = +d["Like work with political parties"];
		cell["boycott"] = +d["Like to boycott"];
		cell["campaign"] = +d["Like to campaign for politician"];

		var global_cell = globals[ai][ii];
		if(countryNames2Population.hasOwnProperty(country) && countryNames2Population[country]!==undefined){
			for(var prop in cell){
				if(cell.hasOwnProperty(prop)){
					//Add value*population to the globals
					if(!global_cell.hasOwnProperty(prop)){
						global_cell[prop] = cell[prop] * countryNames2Population[country];
					}else{
						global_cell[prop] += cell[prop] * countryNames2Population[country];
					}
				}
			}
		}
	});

	//Divide global values by total population to obtain weighted average
	for(var i=0;i<3;i++){
		for(var j=0;j<3;j++){
			var cell = globals[i][j];
			for(var prop in cell){
				if(cell.hasOwnProperty(prop)){
					cell[prop] /= totalPopulation;
				}
			}
		}
	}

	var color = d3.scaleThreshold()
	    .domain(d3.range(1, 10))
	    .range(["#f9fbff","#f1f3ff"].concat(d3.schemeBlues[9].slice(1)));

	//Create countries on map
	var countries = svg.append("g")
		.attr("class", "countries")
	.selectAll("path")
		.data(world.features)
	.enter().append("path")
		.attr("d", path)
		.each(function(d){
			d.properties.NAME_SORT = d.properties.NAME_SORT.toLowerCase();
		})
		.style("fill", getCountryColor)
		.classed("selected",d => d.properties.NAME_SORT==="canada" ? true : false)
		.style('stroke', 'black')
		.style('stroke-width', 0.2)
		.style("opacity",0.8)
		.on('mouseover',function(d){
			tip.show(d);
		})
		.on('mouseout', function(d){
			tip.hide(d);
		})
		.on('click',function(d){  //Update columns when country is clicked
			if(dataByCountry.hasOwnProperty(d.properties.NAME_SORT)){
				selectedCountry = d.properties.NAME_SORT;
				$("#d3-container path").removeClass("selected");
				$(this).addClass("selected");
				updateColumns();
				updateInfo();
			}
		});

	d3.select("#color-legend").selectAll("div")
	  .data(color.range().reverse())
	  .enter().append("div")
	    .style("background-color", d => d);


	//When an age or interest button is clicked, update the column charts and map colors
	$("#interest-div button").on("click",function(){
		if($(this).hasClass('selected')){
			$("#interest-div button").removeClass("selected");
			interestIndex = undefined;
		}else{
			$("#interest-div button").removeClass("selected");
			$(this).addClass("selected");
			interestIndex = +$(this).attr("name");
		}
		updateColumns();
		updateInfo();
		countries.transition().duration(500).style("fill",getCountryColor);
	});

	$("#age-div button").on("click",function(){
		if($(this).hasClass('selected')){
			$("#age-div button").removeClass("selected");
			ageIndex = undefined;
		}else{
			$("#age-div button").removeClass("selected");
			$(this).addClass("selected");
			ageIndex = +$(this).attr("name");
		}
		updateColumns();
		updateInfo();
		countries.transition().duration(500).style("fill",getCountryColor);
	});

	//When a new variable is selected, update the map colors
	$(".column-container").on("click",function(){
		selectedVariable = $(this).attr('name');
		$(".column-container").removeClass("selected");
		$(this).addClass("selected");
		updateColumns();
		countries.transition().duration(500).style("fill",getCountryColor);
	});

	function getCountryColor(d){
		var country = d.properties.NAME_SORT;
		if(dataByCountry.hasOwnProperty(country)){
			var cell = getCell(country);
			var value = cell[selectedVariable];
			return color(value);
		}else{
			return 'white';
		}
	}

	//Update columns based on data from selected country, age, and interest
	function updateColumns(){
		var cell = getCell(),
			global_cell = getCell('globals');
		//Update all columns
		updateColumn(d3.select("#satisfaction-container"),cell["satisfaction"], global_cell["satisfaction"]);
		updateColumn(d3.select("#voice-container"),cell["voice"], global_cell["voice"]);
		updateColumn(d3.select("#demo-container"),cell["democracy"], global_cell["democracy"]);
		updateColumn(d3.select("#other-container"),cell["other"], global_cell["other"]);
		updateColumn(d3.select("#protest-container"),cell["protest"], global_cell["protest"]);
		updateColumn(d3.select("#boycott-container"),cell["boycott"], global_cell["boycott"]);
		updateColumn(d3.select("#party-container"),cell["party"], global_cell["party"]);
		updateColumn(d3.select("#campaign-container"),cell["campaign"], global_cell["campaign"]);

		
		
	}

	var scaleY = d3.scaleLinear().domain([1,10]).range([15,150]);

	// animate a column to the appropriate value
	function updateColumn(container, value, global_value){
		container.select(".column-div").transition()
				.duration(500)
				.style("height",scaleY(value)+"px")
				.style("background-color",container.classed('selected') ? "orange" : color(value));
		container.select("img").transition()
				.duration(500)
				.style("bottom",scaleY(global_value)+25+"px");
	}


	function updateInfo(){
		$("#column-info").html(`${selectedCountry} <span>${ageIndex!==undefined || interestIndex!==undefined ? "(" : ""}${ageIndex!==undefined ? "age ":""} \
			${ageIndex==0 ? "<29" : ageIndex==1 ? "29-38" : ageIndex==2 ? ">38" : ""}${interestIndex!==undefined && ageIndex!==undefined ? ", " : ""}\
			${interestIndex==0 ? "low" : interestIndex==1 ? "medium" : interestIndex==2 ? "high" : ""}${interestIndex!==undefined ? " political interest":""}\
			${ageIndex!==undefined || interestIndex!==undefined ? ")" : ""}</span>`);
	}

	function getCell(country){
		var cells,
			empty = {
				"satisfaction":0,
				"voice":0,
				"democracy":0,
				"other":0,
				"protest":0,
				"party":0,
				"campaign":0,
				"boycott":0
			};
		if(country===undefined){
			var country = selectedCountry;
		}

		//If no age/interest is selected, then create a new cell by averaging together values from the appropriate cells
		if(ageIndex===undefined && interestIndex===undefined){
			cells = dataByCountry[country].reduce(function(a,b){return a.concat(b)},[]);
		}else if(ageIndex===undefined){
			cells = dataByCountry[country].reduce(function(a,b){return a.concat(b[interestIndex])},[]);
		}else if(interestIndex===undefined){
			cells = dataByCountry[country][ageIndex];
		}else{
			cells = [dataByCountry[country][ageIndex][interestIndex]];
		}
		var cell = cells.reduce(function(a,b){
			var sum = {};
			for(prop in a){
				if(a.hasOwnProperty(prop)){
					sum[prop] = a[prop] + b[prop];
				}
			}
			return sum;
		},empty);
		for(prop in cell){
			if(cell.hasOwnProperty(prop)){
				cell[prop] /= cells.length;
			}
		}
		return cell;
	}

	var f = d3.format(".1f");

	// Set tooltips
	var tip = d3.tip()
			.attr('class', 'd3-tip')
			.offset([-10, 0])
			.html(function(d) {
				var country, country_readable, value;
					country = d.properties.NAME_SORT;
					country_readable = d.properties.NAME
				if(dataByCountry.hasOwnProperty(country)){
					value = getCell(country)[selectedVariable]
					if(value % 1 !== 0){
						value = f(value)
					}
				}else{
					value = " not surveyed";
				}
				return "<strong>Country: </strong><span class='details'>" + country_readable + "<br></span>"
				 + "<strong>"+selectedVariable[0].toUpperCase()+selectedVariable.slice(1)+
				 ": </strong><span class='details'>" + value +"</span>";
			})

	function getCountriesStartingWith(prefix){
		var suggestions = [];
		var lenP = prefix.length;
		var k, subK;
		for(var i = 0; i<countrySuggestions.length; i++){
			k = countrySuggestions[i].toLowerCase();
			subK = k.slice(0,lenP)
			if(subK > prefix){
				break;
			}else if(subK === prefix){
				suggestions.push(k);
			}
		}
		return suggestions;
	}

	// JQUERY UI AUTOCOMPLETE WIDGET
	$('#search-query').autocomplete({
		source: function(request, response){
			var results = getCountriesStartingWith(request.term.toLowerCase());
	        response(results.slice(0, 6));
		}
	});

	function selectCountryByName(country){
		if(sortNames2DataNames.hasOwnProperty(country)){
			country = sortNames2DataNames[country];
		}
		if(countrySuggestions.indexOf(country)>-1){
			//Update map selection, columns, and info
			$("#d3-container path").removeClass("selected");
			countries.each(function(d){
				if(d.properties.NAME_SORT.toLowerCase()===country){
					$(this).addClass("selected");
				}
			})
			selectedCountry = country;
			updateInfo();
			updateColumns();
		}else{
			console.log(country);
		}
	}

	//Select country on Enter or pressing button
	$("#search-query").on("keyup",function(e){
		if(e.key === "Enter"){
			selectCountryByName($(this).val());
		}
	})

	//Select country on Enter or pressing button
	$("#search-button").on("click",function(e){
		if(e.key === "Enter"){
			selectCountryByName($("#search-query").val());
		}
	})

	updateColumns();
	updateInfo();
	svg.call(tip);
}