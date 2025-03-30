import React from "react";
import BottomBanner from "../components/BottomBanner.js";

function AboutUs() {
  return (
    <>
      <div
        style={{
          backgroundColor: "#fff",
          color: "#333",
          minHeight: "100vh",
          padding: "60px 20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* -- TOP SECTION with heading + bar + main text -- */}
          <div
            style={{
              display: "flex",
              gap: "30px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* COLUMN 1: HEADING */}
            <div style={{ width: "300px", minWidth: "180px" }}>
              <h1
                style={{
                  fontSize: "2.5rem",
                  margin: 0,
                  color: "#5A153D",
                }}
              >
                About Viserra
              </h1>
            </div>

            {/* COLUMN 2: VERTICAL BAR */}
            <div
              style={{
                width: "2px",
                backgroundColor: "#ccc",
                height: "320px",
                alignSelf: "center",
              }}
            ></div>

            {/* COLUMN 3: MAIN TEXT */}
            <div style={{ flex: 1, minWidth: "280px" }}>
              <h2
                style={{
                  fontSize: "1.7rem",
                  marginBottom: "1rem",
                  color: "#5A153D",
                  marginTop: 0,
                }}
              >
                A New Vision for Real Estate Investing
              </h2>
              <p
                style={{
                  lineHeight: "1.6",
                  fontSize: "1rem",
                  marginBottom: "1.2rem",
                }}
              >
                Viserra combines <strong>“Vision”</strong> and <strong>“Terra”</strong> 
                (Latin for “land”) to embody our mission: bringing a fresh perspective 
                to real estate investment. Our team draws on decades of experience 
                in REIT equity research and private equity real estate, and cutting‐edge 
                software development. By blending real‐estate domain knowledge with 
                modern data science, we aim to create a platform that empowers 
                investors in both public and private markets.
              </p>

              <p
                style={{
                  lineHeight: "1.6",
                  fontSize: "1rem",
                  marginBottom: "1.2rem",
                }}
              >
                Unlike generic stock analytics platforms, Viserra is purpose‐built for real 
                estate. We cover everything from FFO and NOI to Cap Rates and NAV, 
                offering specialized metrics that real‐estate investors rely on. We 
                also pride ourselves on meticulous data accuracy, as we devote extra effort 
                to verify and maintain the integrity of every dataset on our platform.
              </p>
            </div>
          </div>

          {/* -- WHY VISERRA SECTION -- */}
          <div style={{ marginTop: "7rem" }}>
            <h2
              style={{
                fontSize: "1.7rem",
                marginBottom: "1rem",
                color: "#5A153D",
              }}
            >
              Why Viserra?
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ lineHeight: "1.6", fontSize: "1rem" }}>
                <strong style={{ color: "#B12D78" }}>Built for Real Estate</strong> &nbsp;
                We specialize in REITs and property‐focused crowdfunding investments.
                No more wasting time on generic stock metrics that don’t apply.
              </div>

              <div style={{ lineHeight: "1.6", fontSize: "1rem" }}>
                <strong style={{ color: "#B12D78" }}>Data Accuracy</strong> &nbsp;
                Our team painstakingly checks official company filings, prospectuses, 
                and investor relations documents to ensure each data point is 
                thoroughly verified.
              </div>

              <div style={{ lineHeight: "1.6", fontSize: "1rem" }}>
                <strong style={{ color: "#B12D78" }}>Unmatched Data Depth</strong> &nbsp;
                Our platform is backed by some of the world’s most comprehensive financial databases, 
                including S&P Capital IQ, Bloomberg, MSCI Real Capital Analytics, and CoStar. 
                This enable us to provide a depth of data that is unmatched in the industry.
              </div>

              <div style={{ lineHeight: "1.6", fontSize: "1rem" }}>
                <strong style={{ color: "#B12D78" }}>Quantitative Scoring System</strong> &nbsp;
                Our proprietary scoring system assesses real estate investments 
                using real time pricing and operating data. We do the heavy lifting 
                analysis so you don’t have to.
              </div>
            </div>
          </div>

          {/* -- LOCATION SECTION -- */}
          <div style={{ marginTop: "7rem" }}>
            <h2
              style={{
                fontSize: "1.7rem",
                marginBottom: "1rem",
                color: "#5A153D",
              }}
            >
              Our Locations
            </h2>

            {/* Keep styling consistent with the rest */}
            <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
              <div style={{ flex: "1", minWidth: "200px" }}>
                <h4 style={{ color: "#B12D78", marginBottom: "0.5rem" }}>
                  Cleveland Office
                </h4>
                <p style={{ margin: 0, lineHeight: "1.6", fontSize: "1rem" }}>
                  2020 Lorain Avenue
                  <br />
                  Cleveland, Ohio 44113
                </p>
              </div>

              <div style={{ flex: "1", minWidth: "200px" }}>
                <h4 style={{ color: "#B12D78", marginBottom: "0.5rem" }}>
                  Pittsburgh Office
                </h4>
                <p style={{ margin: 0, lineHeight: "1.6", fontSize: "1rem" }}>
                  5727 Elwood Street
                  <br />
                  Pittsburgh, Pennsylvania 15232
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The new bottom banner that slides up at scroll-bottom */}
      <BottomBanner />
    </>
  );
}

export default AboutUs;
